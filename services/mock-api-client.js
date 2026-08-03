const { MENU_ITEMS } = require("../data/menu");
const { ORDER_STATUS, ROLE } = require("./constants");
const {
  buildOrderEvent,
  getNextOrderStatus,
} = require("./order-state");

function createMockApiClient({ now = () => new Date(), initialOrders = [] } = {}) {
  const state = {
    currentUser: null,
    menuItems: clone(MENU_ITEMS),
    notificationLogs: [],
    orders: clone(initialOrders),
    sequence: 1,
    subscriptions: [],
  };

  function nextId(prefix) {
    const id = `${prefix}_${String(state.sequence).padStart(4, "0")}`;
    state.sequence += 1;
    return id;
  }

  function currentNow() {
    const value = now();
    return value instanceof Date ? value : new Date(value);
  }

  async function wechatLogin({ code, devRoleOverride } = {}) {
    if (!code) {
      throw createError("AUTH_INVALID_CODE", "微信登录 code 无效");
    }

    const role = devRoleOverride || ROLE.CAT;
    const user = {
      id: role === ROLE.OWNER ? "usr_owner" : "usr_cat",
      role,
      displayName: role === ROLE.OWNER ? "主人" : "咪",
      openidBound: true,
    };

    state.currentUser = user;

    return {
      token: `mock-token-${role}`,
      user: clone(user),
    };
  }

  async function listMenuItems({ mealTime, mood, q = "", includeHidden = false } = {}) {
    if (includeHidden) {
      requireRole(ROLE.OWNER);
    }

    const normalized = q.trim().toLowerCase();
    const items = state.menuItems.filter((item) => {
      if (item.hidden && !includeHidden) return false;
      if (mealTime && !item.recommendedMealTimes.includes(mealTime)) return false;
      if (mood && !item.recommendedMoods.includes(mood)) return false;
      if (!normalized) return true;
      return [item.name, item.description, item.catReason, item.tags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });

    return {
      items: clone(items),
      nextCursor: null,
    };
  }

  async function createMenuItem(menuItemInput) {
    requireRole(ROLE.OWNER);

    const nowValue = currentNow().toISOString();
    const item = buildMenuItem({
      ...menuItemInput,
      id: nextId("menu"),
      createdAt: nowValue,
      updatedAt: nowValue,
    });

    state.menuItems.unshift(item);

    return {
      item: clone(item),
    };
  }

  async function updateMenuItem(menuItemId, patch) {
    requireRole(ROLE.OWNER);

    const item = findMenuItem(menuItemId);
    Object.assign(item, normalizeMenuPatch(patch));
    item.updatedAt = currentNow().toISOString();

    return {
      item: clone(item),
    };
  }

  async function createOrder(orderInput) {
    requireRole(ROLE.CAT);

    const createdAt = currentNow().toISOString();
    const order = {
      id: nextId("ord"),
      catUserId: "usr_cat",
      ownerUserId: "usr_owner",
      mealTime: orderInput.mealTime,
      mood: orderInput.mood,
      status: ORDER_STATUS.SUBMITTED,
      items: orderInput.items.map((item, index) => buildOrderItem(item, index)),
      wishItems: orderInput.wishItems.map((item) => ({
        id: nextId("wish"),
        name: item.name,
        note: item.note || "",
      })),
      note: orderInput.note || "",
      events: [
        buildOrderEvent({
          type: "submitted",
          actorRole: ROLE.CAT,
          note: orderInput.note || "",
          now: new Date(createdAt),
        }),
      ],
      replacementRequests: [],
      unreadByRoles: {
        [ROLE.CAT]: false,
        [ROLE.OWNER]: true,
      },
      lastActorRole: ROLE.CAT,
      notificationSummary: {
        hasWarning: false,
        latestWarning: null,
      },
      createdAt,
      updatedAt: createdAt,
    };

    state.orders.unshift(order);

    return {
      order: clone(order),
    };
  }

  async function listOrders({ scope } = {}) {
    const orders = state.orders.filter((order) => {
      if (scope === "current") {
        return ![ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED].includes(order.status);
      }
      if (scope === "history") {
        return [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED].includes(order.status);
      }
      return true;
    });

    return {
      orders: orders.map((order) => toOrderSummary(order, state.currentUser)),
      nextCursor: null,
    };
  }

  async function getOrder(orderId) {
    const order = findOrder(orderId);
    ensureUnreadByRoles(order);

    return {
      order: clone(order),
    };
  }

  async function markOrderRead(orderId, role) {
    if (!role && !state.currentUser) {
      throw createError("AUTH_REQUIRED", "缺少或无效登录态");
    }

    const readerRole = role || state.currentUser.role;
    if (![ROLE.CAT, ROLE.OWNER].includes(readerRole)) {
      throw createError("INVALID_READER_ROLE", "已读角色无效", { role: readerRole });
    }

    const order = findOrder(orderId);
    ensureUnreadByRoles(order);
    order.unreadByRoles[readerRole] = false;

    return {
      order: clone(order),
    };
  }

  async function createRepeatDraft(orderId) {
    const order = findOrder(orderId);
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
  }

  async function acceptOrder(orderId) {
    return transitionOrder(orderId, "accept", "accepted");
  }

  async function startCooking(orderId) {
    return transitionOrder(orderId, "start_cooking", "cooking");
  }

  async function completeOrder(orderId) {
    return transitionOrder(orderId, "complete", "completed");
  }

  async function cancelOrder(orderId, input = {}) {
    requireAnyRole([ROLE.CAT, ROLE.OWNER]);

    const actorRole = state.currentUser.role;
    const order = findOrder(orderId);
    const nextStatus = getNextOrderStatus({
      currentStatus: order.status,
      action: "cancel",
      actorRole,
    });
    const updatedAt = currentNow().toISOString();
    const unreadRole = actorRole === ROLE.OWNER ? ROLE.CAT : ROLE.OWNER;

    order.status = nextStatus;
    order.updatedAt = updatedAt;
    order.lastActorRole = actorRole;
    ensureUnreadByRoles(order);
    order.unreadByRoles[actorRole] = false;
    order.unreadByRoles[unreadRole] = true;
    order.events.push(
      buildOrderEvent({
        type: "cancelled",
        actorRole,
        note: input.note || "",
        now: new Date(updatedAt),
      })
    );

    return {
      order: clone(order),
    };
  }

  async function requestReplacement(orderId, input) {
    requireRole(ROLE.OWNER);

    const order = findOrder(orderId);
    const replacements = input && Array.isArray(input.replacements) ? input.replacements : [];
    if (!replacements.length) {
      throw createError("INVALID_REPLACEMENT_REQUEST", "至少要写一道想替换的菜");
    }

    const nextStatus = getNextOrderStatus({
      currentStatus: order.status,
      action: "request_replacement",
      actorRole: ROLE.OWNER,
    });
    const updatedAt = currentNow().toISOString();
    const request = {
      id: nextId("rr"),
      status: "pending",
      replacements: replacements.map((replacement) => buildReplacementInput(order, replacement)),
      catNote: "",
      createdAt: updatedAt,
      decidedAt: null,
    };

    order.replacementRequests.push(request);
    order.status = nextStatus;
    order.updatedAt = updatedAt;
    order.lastActorRole = ROLE.OWNER;
    ensureUnreadByRoles(order);
    order.unreadByRoles[ROLE.CAT] = true;
    order.unreadByRoles[ROLE.OWNER] = false;
    order.events.push(
      buildOrderEvent({
        type: "replacement_requested",
        actorRole: ROLE.OWNER,
        note: request.replacements.map((replacement) => replacement.reason).join("；"),
        now: new Date(updatedAt),
      })
    );

    return {
      order: clone(order),
    };
  }

  async function confirmReplacement(orderId, replacementRequestId, input = {}) {
    requireRole(ROLE.CAT);

    const order = findOrder(orderId);
    const request = findReplacementRequest(order, replacementRequestId);
    assertPendingReplacement(request);
    const updatedAt = currentNow().toISOString();
    const nextStatus = getNextOrderStatus({
      currentStatus: order.status,
      action: "confirm_replacement",
      actorRole: ROLE.CAT,
      hasPendingReplacement: true,
    });

    for (const replacement of request.replacements) {
      applyConfirmedReplacement(order, replacement);
    }

    request.status = "confirmed";
    request.catNote = input.note || "";
    request.decidedAt = updatedAt;
    order.status = nextStatus;
    order.updatedAt = updatedAt;
    order.lastActorRole = ROLE.CAT;
    ensureUnreadByRoles(order);
    order.unreadByRoles[ROLE.CAT] = false;
    order.unreadByRoles[ROLE.OWNER] = true;
    order.events.push(
      buildOrderEvent({
        type: "replacement_confirmed",
        actorRole: ROLE.CAT,
        note: input.note || "",
        now: new Date(updatedAt),
      })
    );

    return {
      order: clone(order),
    };
  }

  async function rejectReplacement(orderId, replacementRequestId, input = {}) {
    requireRole(ROLE.CAT);

    const order = findOrder(orderId);
    const request = findReplacementRequest(order, replacementRequestId);
    assertPendingReplacement(request);
    const updatedAt = currentNow().toISOString();
    const nextAction = input.nextAction || "cancel";
    const nextStatus = nextAction === "cancel" ? ORDER_STATUS.CANCELLED : ORDER_STATUS.SUBMITTED;

    request.status = "rejected";
    request.catNote = input.note || "";
    request.decidedAt = updatedAt;
    order.status = nextStatus;
    order.updatedAt = updatedAt;
    order.lastActorRole = ROLE.CAT;
    ensureUnreadByRoles(order);
    order.unreadByRoles[ROLE.CAT] = false;
    order.unreadByRoles[ROLE.OWNER] = true;
    order.events.push(
      buildOrderEvent({
        type: "replacement_rejected",
        actorRole: ROLE.CAT,
        note: input.note || "",
        now: new Date(updatedAt),
      })
    );

    return {
      order: clone(order),
    };
  }

  async function recordNotificationSubscriptions(input) {
    state.subscriptions.push(clone(input));
    return {
      recorded: true,
    };
  }

  async function listNotificationLogs({ orderId } = {}) {
    const logs = state.notificationLogs.filter((log) => !orderId || log.orderId === orderId);
    return {
      logs: clone(logs),
      nextCursor: null,
    };
  }

  function transitionOrder(orderId, action, eventType) {
    requireRole(ROLE.OWNER);

    const order = findOrder(orderId);
    const hasPendingReplacement = order.replacementRequests.some((request) => request.status === "pending");
    const nextStatus = getNextOrderStatus({
      currentStatus: order.status,
      action,
      actorRole: ROLE.OWNER,
      hasPendingReplacement,
    });
    const updatedAt = currentNow().toISOString();

    order.status = nextStatus;
    order.updatedAt = updatedAt;
    order.lastActorRole = ROLE.OWNER;
    ensureUnreadByRoles(order);
    order.unreadByRoles[ROLE.CAT] = true;
    order.unreadByRoles[ROLE.OWNER] = false;
    order.events.push(
      buildOrderEvent({
        type: eventType,
        actorRole: ROLE.OWNER,
        now: new Date(updatedAt),
      })
    );

    return {
      order: clone(order),
    };
  }

  function buildOrderItem(item, index) {
    const menuItem = state.menuItems.find((candidate) => candidate.id === item.menuItemId && !candidate.hidden);
    if (!menuItem) {
      throw createError("MENU_ITEM_NOT_FOUND", "菜品不存在或不可见", {
        menuItemId: item.menuItemId,
      });
    }

    return {
      id: nextId(`ord_item_${index + 1}`),
      menuItemId: menuItem.id,
      name: menuItem.name,
      quantity: item.quantity,
      note: item.note || "",
      replacementForItemId: null,
    };
  }

  function buildReplacementInput(order, replacement) {
    const original = order.items.find((item) => item.id === replacement.originalItemId);
    if (!original) {
      throw createError("ORDER_ITEM_NOT_FOUND", "原来的菜不存在", {
        originalItemId: replacement.originalItemId,
      });
    }
    const menuItem = replacement.replacementMenuItemId ? findVisibleMenuItem(replacement.replacementMenuItemId) : null;

    return {
      originalItemId: original.id,
      originalItemName: original.name,
      replacementMenuItemId: menuItem ? menuItem.id : "",
      replacementMenuItemName: menuItem ? menuItem.name : "",
      replacementWishName: replacement.replacementWishName || "",
      reason: replacement.reason || "",
    };
  }

  function applyConfirmedReplacement(order, replacement) {
    const index = order.items.findIndex((item) => item.id === replacement.originalItemId);
    if (index < 0) {
      throw createError("ORDER_ITEM_NOT_FOUND", "原来的菜不存在", {
        originalItemId: replacement.originalItemId,
      });
    }
    const original = order.items[index];
    const menuItem = findVisibleMenuItem(replacement.replacementMenuItemId);
    order.items[index] = {
      id: nextId("ord_item_replace"),
      menuItemId: menuItem.id,
      name: menuItem.name,
      quantity: original.quantity,
      note: original.note || "",
      replacementForItemId: original.id,
    };
  }

  function findReplacementRequest(order, replacementRequestId) {
    const request = order.replacementRequests.find((candidate) => candidate.id === replacementRequestId);
    if (!request) {
      throw createError("REPLACEMENT_REQUEST_NOT_FOUND", "替换请求不存在", { replacementRequestId });
    }
    return request;
  }

  function assertPendingReplacement(request) {
    if (request.status !== "pending") {
      throw createError("REPLACEMENT_ALREADY_DECIDED", "这次替换已经处理过了", { status: request.status });
    }
  }

  function findVisibleMenuItem(menuItemId) {
    const item = findMenuItem(menuItemId);
    if (item.hidden) {
      throw createError("MENU_ITEM_NOT_FOUND", "菜品不存在或不可见", { menuItemId });
    }
    return item;
  }

  function findOrder(orderId) {
    const order = state.orders.find((candidate) => candidate.id === orderId);
    if (!order) {
      throw createError("ORDER_NOT_FOUND", "订单不存在", { orderId });
    }
    return order;
  }

  function findMenuItem(menuItemId) {
    const item = state.menuItems.find((candidate) => candidate.id === menuItemId);
    if (!item) {
      throw createError("MENU_ITEM_NOT_FOUND", "菜品不存在或不可见", { menuItemId });
    }
    return item;
  }

  function requireRole(role) {
    if (!state.currentUser) {
      throw createError("AUTH_REQUIRED", "缺少或无效登录态");
    }
    if (state.currentUser.role !== role) {
      throw createError("FORBIDDEN_ROLE", "当前角色不能执行操作", {
        requiredRole: role,
        currentRole: state.currentUser.role,
      });
    }
  }

  function requireAnyRole(roles) {
    if (!state.currentUser) {
      throw createError("AUTH_REQUIRED", "缺少或无效登录态");
    }
    if (!roles.includes(state.currentUser.role)) {
      throw createError("FORBIDDEN_ROLE", "当前角色不能执行操作", {
        allowedRoles: roles,
        currentRole: state.currentUser.role,
      });
    }
  }

  return {
    acceptOrder,
    cancelOrder,
    completeOrder,
    confirmReplacement,
    createMenuItem,
    createOrder,
    createRepeatDraft,
    getOrder,
    listMenuItems,
    listNotificationLogs,
    listOrders,
    markOrderRead,
    recordNotificationSubscriptions,
    rejectReplacement,
    requestReplacement,
    startCooking,
    updateMenuItem,
    wechatLogin,
  };
}

function buildMenuItem(input) {
  const category = input.category || input.categoryId || "main";

  return {
    id: input.id,
    categoryId: category,
    category,
    name: input.name,
    description: input.description,
    catReason: input.catReason,
    tags: input.tags || [],
    recommendedMealTimes: input.recommendedMealTimes || [],
    recommendedMoods: input.recommendedMoods || [],
    estimatedMinutes: Number(input.estimatedMinutes || input.cookingMinutes || 0),
    cookingMinutes: Number(input.cookingMinutes || input.estimatedMinutes || 0),
    hidden: Boolean(input.hidden),
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

function normalizeMenuPatch(patch) {
  const normalized = {};
  for (const key of [
    "name",
    "description",
    "catReason",
    "tags",
    "recommendedMealTimes",
    "recommendedMoods",
    "hidden",
  ]) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      normalized[key] = patch[key];
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, "category")) {
    normalized.category = patch.category;
    normalized.categoryId = patch.category;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "categoryId")) {
    normalized.categoryId = patch.categoryId;
    normalized.category = patch.categoryId;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "estimatedMinutes")) {
    normalized.estimatedMinutes = Number(patch.estimatedMinutes);
    normalized.cookingMinutes = Number(patch.estimatedMinutes);
  }

  return normalized;
}

function toOrderSummary(order, currentUser) {
  ensureUnreadByRoles(order);

  return {
    id: order.id,
    mealTime: order.mealTime,
    mood: order.mood,
    status: order.status,
    replacementRequests: clone(order.replacementRequests || []),
    hasUnreadUpdate: Boolean(currentUser && order.unreadByRoles[currentUser.role]),
    itemNames: [
      ...order.items.map((item) => item.name),
      ...order.wishItems.map((item) => item.name),
    ],
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function ensureUnreadByRoles(order) {
  order.unreadByRoles = {
    [ROLE.CAT]: Boolean(order.unreadByRoles && order.unreadByRoles[ROLE.CAT]),
    [ROLE.OWNER]: Boolean(order.unreadByRoles && order.unreadByRoles[ROLE.OWNER]),
  };
  return order.unreadByRoles;
}

function createError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  createMockApiClient,
};
