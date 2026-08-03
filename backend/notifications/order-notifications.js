const {
  MEAL_TIME_LABELS,
  NOTIFICATION_TEMPLATE_KEY,
  ROLE,
} = require("../../services/constants");

const ACTION_NOTIFICATIONS = {
  cat_submit_order: {
    page: "pages/owner/owner",
    recipientRole: ROLE.OWNER,
    templateKey: NOTIFICATION_TEMPLATE_KEY.OWNER_NEW_ORDER,
    title: (order) => `咪点了${MEAL_TIME_LABELS[order.mealTime] || "饭"}`,
  },
  owner_request_replacement: {
    page: "pages/order/order",
    recipientRole: ROLE.CAT,
    templateKey: NOTIFICATION_TEMPLATE_KEY.CAT_REPLACEMENT_REQUESTED,
    title: () => "主人想换一道",
  },
  owner_accept_order: {
    page: "pages/order/order",
    recipientRole: ROLE.CAT,
    templateKey: NOTIFICATION_TEMPLATE_KEY.CAT_ORDER_ACCEPTED,
    title: () => "主人收到啦",
  },
  owner_start_cooking: {
    page: "pages/order/order",
    recipientRole: ROLE.CAT,
    templateKey: NOTIFICATION_TEMPLATE_KEY.CAT_ORDER_COOKING,
    title: () => "主人开火啦",
  },
  owner_complete_order: {
    page: "pages/order/order",
    recipientRole: ROLE.CAT,
    templateKey: NOTIFICATION_TEMPLATE_KEY.CAT_ORDER_COMPLETED,
    title: () => "可以吃啦",
  },
};

async function sendOrderNotification({ notificationService, orderId, pool, sourceAction }) {
  const spec = ACTION_NOTIFICATIONS[sourceAction];
  if (!spec || !notificationService) return { status: "disabled" };

  const order = await loadNotificationOrder(pool, orderId);
  const recipientUserId = spec.recipientRole === ROLE.OWNER ? order.ownerUserId : order.catUserId;
  const recipientOpenid = spec.recipientRole === ROLE.OWNER ? order.ownerOpenid : order.catOpenid;
  const subscription = await loadSubscription(pool, {
    sourceAction,
    templateKey: spec.templateKey,
    userId: recipientUserId,
  });

  if (!subscription || subscription.status !== "accept") {
    await insertNotificationLog(pool, {
      errorCode: "SUBSCRIPTION_NOT_AUTHORIZED",
      errorMessage: "用户未授权对应订阅消息",
      orderId,
      recipientUserId,
      status: "skipped_not_authorized",
      templateKey: spec.templateKey,
    });
    return { status: "skipped_not_authorized" };
  }

  let result;
  try {
    result = await notificationService.send({
      data: buildNotificationData(order, spec),
      page: `${spec.page}?orderId=${encodeURIComponent(orderId)}`,
      templateKey: spec.templateKey,
      touser: recipientOpenid,
    });
  } catch (error) {
    result = {
      errorCode: "WECHAT_SEND_EXCEPTION",
      errorMessage: error.message || "微信订阅消息发送异常",
      status: "failed",
    };
  }

  await insertNotificationLog(pool, {
    errorCode: result.errorCode || null,
    errorMessage: result.errorMessage || null,
    orderId,
    recipientUserId,
    status: result.status === "sent" ? "sent" : "failed",
    templateKey: spec.templateKey,
  });

  if (result.status !== "sent") {
    await pool.query(
      `
        update orders
        set notification_summary = $1::jsonb
        where id = $2
      `,
      [
        JSON.stringify({
          hasWarning: true,
          latestWarning: {
            code: result.errorCode || "WECHAT_SEND_FAILED",
            message: result.errorMessage || "微信订阅消息发送失败",
            templateKey: spec.templateKey,
          },
        }),
        orderId,
      ],
    );
  }

  return result;
}

async function loadNotificationOrder(pool, orderId) {
  const response = await pool.query(
    `
      select
        orders.id,
        orders.cat_user_id,
        orders.owner_user_id,
        orders.meal_time,
        orders.status,
        orders.updated_at,
        cat.openid as cat_openid,
        owner.openid as owner_openid
      from orders
      join users cat on cat.id = orders.cat_user_id
      join users owner on owner.id = orders.owner_user_id
      where orders.id = $1
    `,
    [orderId],
  );
  const row = response.rows[0];
  if (!row) return null;
  const itemResponse = await pool.query(
    "select name from order_items where order_id = $1 order by created_at asc, id asc",
    [orderId],
  );
  return {
    catOpenid: row.cat_openid || "",
    catUserId: row.cat_user_id,
    id: row.id,
    itemNames: itemResponse.rows.map((item) => item.name),
    mealTime: row.meal_time,
    ownerOpenid: row.owner_openid || "",
    ownerUserId: row.owner_user_id,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

async function loadSubscription(pool, { sourceAction, templateKey, userId }) {
  const response = await pool.query(
    `
      select status
      from notification_subscriptions
      where user_id = $1
        and template_key = $2
        and source_action = $3
    `,
    [userId, templateKey, sourceAction],
  );
  return response.rows[0] || null;
}

async function insertNotificationLog(pool, input) {
  await pool.query(
    `
      insert into notification_logs (
        id,
        order_id,
        template_key,
        recipient_user_id,
        status,
        error_code,
        error_message
      )
      values ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      nextNotificationLogId(),
      input.orderId,
      input.templateKey,
      input.recipientUserId,
      input.status,
      input.errorCode,
      input.errorMessage,
    ],
  );
}

function buildNotificationData(order, spec) {
  return {
    thing1: { value: truncateWechatValue(spec.title(order)) },
    thing2: { value: truncateWechatValue(order.itemNames.join("、") || "小愿望") },
    time3: { value: formatWechatTime(order.updatedAt || new Date()) },
  };
}

function truncateWechatValue(value, maxLength = 20) {
  const text = String(value || "");
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function formatWechatTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function nextNotificationLogId() {
  return `ntf_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

module.exports = {
  ACTION_NOTIFICATIONS,
  buildNotificationData,
  sendOrderNotification,
};
