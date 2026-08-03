const crypto = require("node:crypto");
const { ORDER_STATUS, ROLE } = require("../../services/constants");
const { getNextOrderStatus } = require("../../services/order-state");
const { createHttpError } = require("../auth/dev-auth-service");
const { sendOrderNotification } = require("../notifications/order-notifications");
const { createMenuItemsRepository } = require("../repositories/menu-items-repository");

function createPostgresApiClient({
  pool,
  menuItemsRepository = createMenuItemsRepository(pool),
  notificationService = null,
}) {
  return {
    async createMenuItem(input, user) {
      requireRole(user, ROLE.OWNER);
      return menuItemsRepository.create(input);
    },

    async updateMenuItem(menuItemId, patch, user) {
      requireRole(user, ROLE.OWNER);
      return menuItemsRepository.update(menuItemId, patch);
    },

    async createOrder(input, user) {
      requireRole(user, ROLE.CAT);
      const orderId = nextId("ord");
      const now = new Date();

      await withTransaction(pool, async (tx) => {
        await tx.query(
          `
            insert into orders (
              id,
              cat_user_id,
              owner_user_id,
              meal_time,
              mood,
              status,
              note,
              unread_by_cat,
              unread_by_owner,
              last_actor_role,
              created_at,
              updated_at
            )
            values ($1, $2, $3, $4, $5, $6, $7, false, true, $8, $9, $9)
          `,
          [
            orderId,
            user.id,
            "usr_owner",
            input.mealTime,
            input.mood,
            ORDER_STATUS.SUBMITTED,
            input.note || "",
            ROLE.CAT,
            now,
          ],
        );

        for (const [index, item] of (input.items || []).entries()) {
          const menuItem = await findVisibleMenuItem(tx, item.menuItemId);
          await tx.query(
            `
              insert into order_items (id, order_id, menu_item_id, name, quantity, note)
              values ($1, $2, $3, $4, $5, $6)
            `,
            [
              nextId(`ord_item_${index + 1}`),
              orderId,
              menuItem.id,
              menuItem.name,
              Number(item.quantity || 1),
              item.note || "",
            ],
          );
        }

        for (const item of input.wishItems || []) {
          await tx.query(
            `
              insert into wish_items (id, order_id, name, note)
              values ($1, $2, $3, $4)
            `,
            [nextId("wish"), orderId, item.name, item.note || ""],
          );
        }

        await insertOrderEvent(tx, orderId, "submitted", ROLE.CAT, input.note || "", now);
      });

      await sendOrderNotification({
        notificationService,
        orderId,
        pool,
        sourceAction: "cat_submit_order",
      });
      return this.getOrder(orderId, user);
    },

    async listOrders(input = {}, user) {
      requireUser(user);
      const params = [];
      const clauses = [];
      if (input.scope === "current") {
        clauses.push("status not in ('completed', 'cancelled')");
      } else if (input.scope === "history") {
        clauses.push("status in ('completed', 'cancelled')");
      }
      const whereSql = clauses.length ? `where ${clauses.join(" and ")}` : "";
      const response = await pool.query(
        `
          select *
          from orders
          ${whereSql}
          order by updated_at desc
        `,
        params,
      );
      const orders = [];
      for (const row of response.rows) {
        const order = await loadOrder(pool, row.id);
        orders.push(toOrderSummary(order, user));
      }
      return {
        orders,
        nextCursor: null,
      };
    },

    async getOrder(orderId, user) {
      requireUser(user);
      return {
        order: await loadOrder(pool, orderId),
      };
    },

    async markOrderRead(orderId, user) {
      requireUser(user);
      const column = user.role === ROLE.OWNER ? "unread_by_owner" : "unread_by_cat";
      await pool.query(`update orders set ${column} = false where id = $1`, [orderId]);
      return this.getOrder(orderId, user);
    },

    async createRepeatDraft(orderId, user) {
      requireRole(user, ROLE.CAT);
      const order = await loadOrder(pool, orderId);
      if (order.status !== ORDER_STATUS.COMPLETED) {
        throw createHttpError(400, "ORDER_INVALID_STATUS", "只有吃过的订单可以复点");
      }
      return {
        mealTime: order.mealTime,
        mood: order.mood,
        items: order.items.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          note: item.note || "",
        })),
        wishItems: order.wishItems.map((item) => ({
          name: item.name,
          note: item.note || "",
        })),
        note: order.note || "",
      };
    },

    async acceptOrder(orderId, user) {
      return transitionOwnerOrder(pool, notificationService, orderId, user, "accept", "accepted", "owner_accept_order");
    },

    async startCooking(orderId, user) {
      return transitionOwnerOrder(pool, notificationService, orderId, user, "start_cooking", "cooking", "owner_start_cooking");
    },

    async completeOrder(orderId, user) {
      return transitionOwnerOrder(pool, notificationService, orderId, user, "complete", "completed", "owner_complete_order");
    },

    async cancelOrder(orderId, input = {}, user) {
      requireUser(user);
      const order = await loadOrder(pool, orderId);
      const nextStatus = getNextOrderStatus({
        currentStatus: order.status,
        action: "cancel",
        actorRole: user.role,
      });
      await withTransaction(pool, async (tx) => {
        await updateOrderStatus(tx, orderId, nextStatus, user.role);
        await setUnreadForOppositeRole(tx, orderId, user.role);
        await insertOrderEvent(tx, orderId, "cancelled", user.role, input.note || "");
      });
      return this.getOrder(orderId, user);
    },

    async requestReplacement(orderId, input = {}, user) {
      requireRole(user, ROLE.OWNER);
      const replacements = Array.isArray(input.replacements) ? input.replacements : [];
      if (!replacements.length) {
        throw createHttpError(400, "INVALID_REPLACEMENT_REQUEST", "至少要写一道想替换的菜");
      }
      const order = await loadOrder(pool, orderId);
      const nextStatus = getNextOrderStatus({
        currentStatus: order.status,
        action: "request_replacement",
        actorRole: ROLE.OWNER,
      });
      const requestId = nextId("rr");

      await withTransaction(pool, async (tx) => {
        await tx.query(
          `
            insert into replacement_requests (id, order_id, status)
            values ($1, $2, 'pending')
          `,
          [requestId, orderId],
        );
        for (const replacement of replacements) {
          const original = order.items.find((item) => item.id === replacement.originalItemId);
          if (!original) {
            throw createHttpError(404, "ORDER_ITEM_NOT_FOUND", "原来的菜不存在");
          }
          const menuItem = replacement.replacementMenuItemId
            ? await findVisibleMenuItem(tx, replacement.replacementMenuItemId)
            : null;
          await tx.query(
            `
              insert into replacement_items (
                id,
                replacement_request_id,
                original_item_id,
                original_item_name,
                replacement_menu_item_id,
                replacement_menu_item_name,
                replacement_wish_name,
                reason
              )
              values ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
            [
              nextId("rr_item"),
              requestId,
              original.id,
              original.name,
              menuItem ? menuItem.id : null,
              menuItem ? menuItem.name : "",
              replacement.replacementWishName || "",
              replacement.reason || "",
            ],
          );
        }
        await updateOrderStatus(tx, orderId, nextStatus, ROLE.OWNER);
        await setUnreadForOppositeRole(tx, orderId, ROLE.OWNER);
        await insertOrderEvent(
          tx,
          orderId,
          "replacement_requested",
          ROLE.OWNER,
          replacements.map((item) => item.reason || "").filter(Boolean).join("；"),
        );
      });

      await sendOrderNotification({
        notificationService,
        orderId,
        pool,
        sourceAction: "owner_request_replacement",
      });
      const updated = await loadOrder(pool, orderId);
      return {
        order: updated,
        replacementRequest: updated.replacementRequests.find((item) => item.id === requestId),
      };
    },

    async confirmReplacement(orderId, replacementRequestId, input = {}, user) {
      requireRole(user, ROLE.CAT);
      const order = await loadOrder(pool, orderId);
      const request = findPendingReplacement(order, replacementRequestId);
      const nextStatus = getNextOrderStatus({
        currentStatus: order.status,
        action: "confirm_replacement",
        actorRole: ROLE.CAT,
        hasPendingReplacement: true,
      });

      await withTransaction(pool, async (tx) => {
        for (const replacement of request.replacements) {
          const menuItem = await findVisibleMenuItem(tx, replacement.replacementMenuItemId);
          await tx.query(
            `
              update order_items
              set
                menu_item_id = $1,
                name = $2,
                replacement_for_item_id = $3
              where id = $3 and order_id = $4
            `,
            [menuItem.id, menuItem.name, replacement.originalItemId, orderId],
          );
        }
        await tx.query(
          `
            update replacement_requests
            set status = 'confirmed', cat_note = $1, decided_at = now()
            where id = $2
          `,
          [input.note || "", replacementRequestId],
        );
        await updateOrderStatus(tx, orderId, nextStatus, ROLE.CAT);
        await setUnreadForOppositeRole(tx, orderId, ROLE.CAT);
        await insertOrderEvent(tx, orderId, "replacement_confirmed", ROLE.CAT, input.note || "");
      });

      const updated = await loadOrder(pool, orderId);
      return {
        order: updated,
        replacementRequest: updated.replacementRequests.find((item) => item.id === replacementRequestId),
      };
    },

    async rejectReplacement(orderId, replacementRequestId, input = {}, user) {
      requireRole(user, ROLE.CAT);
      const order = await loadOrder(pool, orderId);
      findPendingReplacement(order, replacementRequestId);
      const nextStatus = input.nextAction === "revise" ? ORDER_STATUS.SUBMITTED : ORDER_STATUS.CANCELLED;
      await withTransaction(pool, async (tx) => {
        await tx.query(
          `
            update replacement_requests
            set status = 'rejected', cat_note = $1, decided_at = now()
            where id = $2
          `,
          [input.note || "", replacementRequestId],
        );
        await updateOrderStatus(tx, orderId, nextStatus, ROLE.CAT);
        await setUnreadForOppositeRole(tx, orderId, ROLE.CAT);
        await insertOrderEvent(tx, orderId, "replacement_rejected", ROLE.CAT, input.note || "");
      });
      const updated = await loadOrder(pool, orderId);
      return {
        order: updated,
        replacementRequest: updated.replacementRequests.find((item) => item.id === replacementRequestId),
      };
    },

    async recordNotificationSubscriptions(input = {}, user) {
      requireUser(user);
      for (const result of input.results || []) {
        await pool.query(
          `
            insert into notification_subscriptions (id, user_id, template_key, source_action, status)
            values ($1, $2, $3, $4, $5)
            on conflict (user_id, template_key, source_action) do update set
              status = excluded.status,
              updated_at = now()
          `,
          [nextId("sub"), user.id, result.templateKey, input.sourceAction || "", result.status],
        );
      }
      return {
        recorded: true,
      };
    },

    async listNotificationLogs(input = {}, user) {
      requireUser(user);
      const params = [];
      const clauses = [];
      if (input.orderId) {
        params.push(input.orderId);
        clauses.push(`order_id = $${params.length}`);
      }
      const whereSql = clauses.length ? `where ${clauses.join(" and ")}` : "";
      const response = await pool.query(
        `
          select id, order_id, template_key, recipient_user_id, status, error_code, error_message, created_at
          from notification_logs
          ${whereSql}
          order by created_at desc
        `,
        params,
      );
      return {
        logs: response.rows.map(mapNotificationLogRow),
        nextCursor: null,
      };
    },
  };
}

async function transitionOwnerOrder(pool, notificationService, orderId, user, action, eventType, sourceAction) {
  requireRole(user, ROLE.OWNER);
  const order = await loadOrder(pool, orderId);
  const hasPendingReplacement = order.replacementRequests.some((request) => request.status === "pending");
  const nextStatus = getNextOrderStatus({
    currentStatus: order.status,
    action,
    actorRole: ROLE.OWNER,
    hasPendingReplacement,
  });
  await withTransaction(pool, async (tx) => {
    await updateOrderStatus(tx, orderId, nextStatus, ROLE.OWNER);
    await setUnreadForOppositeRole(tx, orderId, ROLE.OWNER);
    await insertOrderEvent(tx, orderId, eventType, ROLE.OWNER);
  });
  await sendOrderNotification({
    notificationService,
    orderId,
    pool,
    sourceAction,
  });
  return {
    order: await loadOrder(pool, orderId),
  };
}

async function loadOrder(pool, orderId) {
  const orderResponse = await pool.query("select * from orders where id = $1", [orderId]);
  if (!orderResponse.rows[0]) {
    throw createHttpError(404, "ORDER_NOT_FOUND", "订单不存在", { orderId });
  }
  const [items, wishes, events, replacementRequests] = await Promise.all([
    pool.query("select * from order_items where order_id = $1 order by created_at asc, id asc", [orderId]),
    pool.query("select * from wish_items where order_id = $1 order by created_at asc, id asc", [orderId]),
    pool.query("select * from order_events where order_id = $1 order by created_at asc, id asc", [orderId]),
    loadReplacementRequests(pool, orderId),
  ]);

  return mapOrderRow(orderResponse.rows[0], {
    events: events.rows.map(mapOrderEventRow),
    items: items.rows.map(mapOrderItemRow),
    replacementRequests,
    wishItems: wishes.rows.map(mapWishItemRow),
  });
}

async function loadReplacementRequests(pool, orderId) {
  const requests = await pool.query(
    "select * from replacement_requests where order_id = $1 order by created_at asc, id asc",
    [orderId],
  );
  const result = [];
  for (const request of requests.rows) {
    const items = await pool.query(
      "select * from replacement_items where replacement_request_id = $1 order by id asc",
      [request.id],
    );
    result.push(mapReplacementRequestRow(request, items.rows));
  }
  return result;
}

function mapOrderRow(row, children) {
  return {
    id: row.id,
    catUserId: row.cat_user_id,
    ownerUserId: row.owner_user_id,
    mealTime: row.meal_time,
    mood: row.mood,
    status: row.status,
    items: children.items,
    wishItems: children.wishItems,
    note: row.note || "",
    events: children.events,
    replacementRequests: children.replacementRequests,
    unreadByRoles: {
      [ROLE.CAT]: Boolean(row.unread_by_cat),
      [ROLE.OWNER]: Boolean(row.unread_by_owner),
    },
    lastActorRole: row.last_actor_role,
    notificationSummary: row.notification_summary || { hasWarning: false, latestWarning: null },
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function toOrderSummary(order, user) {
  return {
    id: order.id,
    mealTime: order.mealTime,
    mood: order.mood,
    status: order.status,
    replacementRequests: order.replacementRequests,
    hasUnreadUpdate: Boolean(order.unreadByRoles[user.role]),
    itemNames: [
      ...order.items.map((item) => item.name),
      ...order.wishItems.map((item) => item.name),
    ],
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function mapOrderItemRow(row) {
  return {
    id: row.id,
    menuItemId: row.menu_item_id,
    name: row.name,
    quantity: row.quantity,
    note: row.note || "",
    replacementForItemId: row.replacement_for_item_id,
  };
}

function mapWishItemRow(row) {
  return {
    id: row.id,
    name: row.name,
    note: row.note || "",
  };
}

function mapOrderEventRow(row) {
  return {
    id: row.id,
    type: row.type,
    actorRole: row.actor_role,
    note: row.note || "",
    createdAt: toIso(row.created_at),
  };
}

function mapReplacementRequestRow(row, items) {
  return {
    id: row.id,
    status: row.status,
    replacements: items.map(mapReplacementItemRow),
    catNote: row.cat_note || "",
    createdAt: toIso(row.created_at),
    decidedAt: row.decided_at ? toIso(row.decided_at) : null,
  };
}

function mapReplacementItemRow(row) {
  return {
    originalItemId: row.original_item_id,
    originalItemName: row.original_item_name,
    replacementMenuItemId: row.replacement_menu_item_id || "",
    replacementMenuItemName: row.replacement_menu_item_name || "",
    replacementWishName: row.replacement_wish_name || "",
    reason: row.reason || "",
  };
}

function mapNotificationLogRow(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    templateKey: row.template_key,
    recipientUserId: row.recipient_user_id,
    status: row.status,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: toIso(row.created_at),
  };
}

async function findVisibleMenuItem(queryable, menuItemId) {
  const response = await queryable.query(
    "select id, name from menu_items where id = $1 and hidden = false",
    [menuItemId],
  );
  if (!response.rows[0]) {
    throw createHttpError(404, "MENU_ITEM_NOT_FOUND", "菜品不存在或不可见", { menuItemId });
  }
  return response.rows[0];
}

function findPendingReplacement(order, replacementRequestId) {
  const request = order.replacementRequests.find((item) => item.id === replacementRequestId);
  if (!request) {
    throw createHttpError(404, "REPLACEMENT_REQUEST_NOT_FOUND", "替换请求不存在", { replacementRequestId });
  }
  if (request.status !== "pending") {
    throw createHttpError(400, "REPLACEMENT_ALREADY_DECIDED", "这次替换已经处理过了", {
      status: request.status,
    });
  }
  return request;
}

async function updateOrderStatus(queryable, orderId, status, actorRole) {
  await queryable.query(
    `
      update orders
      set status = $1, last_actor_role = $2, updated_at = now()
      where id = $3
    `,
    [status, actorRole, orderId],
  );
}

async function setUnreadForOppositeRole(queryable, orderId, actorRole) {
  await queryable.query(
    `
      update orders
      set
        unread_by_cat = $1,
        unread_by_owner = $2
      where id = $3
    `,
    [actorRole === ROLE.OWNER, actorRole === ROLE.CAT, orderId],
  );
}

async function insertOrderEvent(queryable, orderId, type, actorRole, note = "", now = new Date()) {
  await queryable.query(
    `
      insert into order_events (id, order_id, type, actor_role, note, created_at)
      values ($1, $2, $3, $4, $5, $6)
    `,
    [nextId("evt"), orderId, type, actorRole, note, now],
  );
}

async function withTransaction(pool, work) {
  const client = await pool.connect();
  const queryable = {
    query(sql, params = []) {
      return client.query(sql, params);
    },
  };
  try {
    await client.query("begin");
    const result = await work(queryable);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function requireRole(user, role) {
  requireUser(user);
  if (user.role !== role) {
    throw createHttpError(403, "FORBIDDEN_ROLE", "当前角色不能执行操作", {
      currentRole: user.role,
      requiredRole: role,
    });
  }
}

function requireUser(user) {
  if (!user) {
    throw createHttpError(401, "AUTH_REQUIRED", "缺少或无效登录态");
  }
}

function nextId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function toIso(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

module.exports = {
  createPostgresApiClient,
  mapOrderRow,
};
