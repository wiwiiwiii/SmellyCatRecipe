const {
  MEAL_TIME_LABELS,
  MOOD_LABELS,
  ORDER_STATUS,
  ROLE,
} = require("./constants");
const { MENU_ITEMS } = require("../data/menu");
const {
  canCancelOrder,
  getStatusCopy,
} = require("./order-state");
const { loginAsRole } = require("./auth-session");

async function loadLatestCatOrder({ api, storage }) {
  const draft = storage.getStorageSync("draftOrder");
  if (isRenderableDraft(draft)) {
    return {
      order: draft.previewOrder,
      source: "draft",
    };
  }

  const orderId = storage.getStorageSync("latestOrderId");
  const cachedOrder = storage.getStorageSync("latestOrder");

  if (orderId && api && typeof api.getOrder === "function") {
    try {
      const response = await api.getOrder(orderId);
      if (isRenderableOrder(response.order)) {
        storage.setStorageSync("latestOrder", response.order);
        return {
          order: response.order,
          source: "api",
        };
      }
    } catch (error) {
      if (isRenderableOrder(cachedOrder)) {
        return {
          order: cachedOrder,
          source: "storage",
          warning: error.message,
        };
      }
      throw error;
    }
  }

  if (isRenderableOrder(cachedOrder)) {
    return {
      order: cachedOrder,
      source: "storage",
    };
  }

  return {
    order: null,
    source: "empty",
  };
}

function createCatOrderDraft(orderInput) {
  const input = normalizeOrderInput(orderInput);
  const previewOrder = {
    id: "draft_order",
    isDraft: true,
    mealTime: input.mealTime,
    mood: input.mood,
    status: "draft",
    items: input.items.map((item, index) => buildDraftOrderItem(item, index)),
    wishItems: input.wishItems.map((item, index) => ({
      id: `draft_wish_${index + 1}`,
      name: item.name,
      note: item.note || "",
    })),
    note: input.note,
    notificationSummary: {
      hasWarning: false,
      latestWarning: null,
    },
    unreadByRoles: {
      [ROLE.CAT]: false,
      [ROLE.OWNER]: false,
    },
  };

  return {
    id: previewOrder.id,
    input,
    previewOrder,
  };
}

async function sendCatOrderDraft({ api, apiBaseUrl, storage }) {
  const draft = storage.getStorageSync("draftOrder");
  if (!isRenderableDraft(draft)) {
    throw new Error("还没有可以发送的点餐单");
  }

  if (api && typeof api.wechatLogin === "function") {
    await loginAsRole({ api, apiBaseUrl, role: ROLE.CAT });
  }

  const response = await api.createOrder(draft.input);
  removeStorage(storage, "draftOrder");
  storage.setStorageSync("latestOrderId", response.order.id);
  storage.setStorageSync("latestOrder", response.order);

  return response;
}

function buildCatOrderView(order) {
  if (order.isDraft) {
    return {
      canCancel: false,
      cancelLabel: "",
      canSend: true,
      canConfirmReplacement: false,
      hasPendingReplacement: false,
      hasNotificationWarning: false,
      hasUnreadUpdate: false,
      hasWishItems: Array.isArray(order.wishItems) && order.wishItems.length > 0,
      isDraft: true,
      mealTimeText: MEAL_TIME_LABELS[order.mealTime] || order.mealTime,
      message: formatCatOrderMessage(order),
      moodText: MOOD_LABELS[order.mood] || "",
      order,
      pendingReplacementRequest: null,
      statusCopy: "点菜单先放这里，还没发给主人",
      statusDetail: "确认没问题再发送，主人现在还看不到。",
      statusLabel: "还没发送",
      statusTitle: "咪先看看这份点菜单",
      unreadLabel: "",
    };
  }

  const status = order.status || ORDER_STATUS.SUBMITTED;
  const normalizedOrder = {
    ...order,
    status,
  };
  const canCancel = canCancelOrder(normalizedOrder);
  const pendingReplacementRequest = canCancel ? buildPendingReplacementRequest(normalizedOrder) : null;

  return {
    canCancel,
    canConfirmReplacement: Boolean(pendingReplacementRequest),
    cancelLabel: canCancel ? "咪不吃了" : "",
    canSend: false,
    hasPendingReplacement: Boolean(pendingReplacementRequest),
    hasNotificationWarning: Boolean(order.notificationSummary && order.notificationSummary.hasWarning),
    hasUnreadUpdate: Boolean(order.unreadByRoles && order.unreadByRoles[ROLE.CAT]),
    hasWishItems: Array.isArray(order.wishItems) && order.wishItems.length > 0,
    isDraft: false,
    mealTimeText: MEAL_TIME_LABELS[order.mealTime] || order.mealTime,
    message: formatCatOrderMessage(normalizedOrder),
    moodText: MOOD_LABELS[order.mood] || "",
    order: normalizedOrder,
    pendingReplacementRequest,
    statusCopy: getCatStatusTitle(status, normalizedOrder, pendingReplacementRequest),
    statusDetail: getCatStatusDetail(status, normalizedOrder, pendingReplacementRequest),
    statusLabel: "当前状态",
    statusTitle: getCatStatusTitle(status, normalizedOrder, pendingReplacementRequest),
    unreadLabel: order.unreadByRoles && order.unreadByRoles[ROLE.CAT] ? "有新进展" : "",
  };
}

function buildEmptyCatOrderView() {
  return {
    canCancel: false,
    canSend: false,
    canConfirmReplacement: false,
    cancelLabel: "",
    hasOrder: false,
    hasNotificationWarning: false,
    hasPendingReplacement: false,
    hasUnreadUpdate: false,
    hasWishItems: false,
    isDraft: false,
    mealTimeText: "",
    message: "",
    moodText: "",
    order: null,
    pendingReplacementRequest: null,
    statusDetail: "",
    statusLabel: "",
    statusCopy: "",
    statusTitle: "",
    unreadLabel: "",
  };
}

function hasLatestCatOrder(storage) {
  return Boolean(storage.getStorageSync("draftOrder") || storage.getStorageSync("latestOrderId"));
}

function formatCatOrderMessage(order) {
  const itemLines = order.items.map((item, index) => {
    return `${index + 1}. ${item.name}${item.note ? `（${item.note}）` : ""}`;
  });
  const wishLines = order.wishItems.map((item, index) => {
    return `愿望 ${index + 1}. ${item.name}${item.note ? `（${item.note}）` : ""}`;
  });

  return [
    "小狗咪的喂食器点餐单",
    `餐次：${MEAL_TIME_LABELS[order.mealTime] || order.mealTime}`,
    `状态：${MOOD_LABELS[order.mood] || order.mood}`,
    ...itemLines,
    ...wishLines,
    `备注：${order.note || "无"}`,
  ].join("\n");
}

function buildPendingReplacementRequest(order) {
  const request = (order.replacementRequests || []).find((item) => item.status === "pending");
  if (!request) return null;

  const replacements = request.replacements || [];
  const itemsText = replacements
    .map((item) => {
      const originalName = item.originalItemName || findOrderItemName(order, item.originalItemId);
      const replacementName = item.replacementMenuItemName || item.replacementWishName || "主人换的菜";
      return `${originalName} → ${replacementName}`;
    })
    .join("、");

  return {
    ...request,
    title: "主人想换一道",
    itemsText,
    reasonText: replacements[0] && replacements[0].reason ? replacements[0].reason : "主人想换个更稳的安排，咪看一下好不好。",
  };
}

function findOrderItemName(order, itemId) {
  const item = (order.items || []).find((candidate) => candidate.id === itemId);
  return item ? item.name : "原来的菜";
}

function isRenderableOrder(order) {
  return Boolean(order && Array.isArray(order.items) && Array.isArray(order.wishItems) && order.status);
}

function isRenderableDraft(draft) {
  return Boolean(draft && draft.input && isRenderableOrder(draft.previewOrder) && draft.previewOrder.isDraft);
}

function normalizeOrderInput(orderInput) {
  return {
    mealTime: orderInput.mealTime,
    mood: orderInput.mood,
    items: (orderInput.items || []).map((item) => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity || 1,
      note: item.note || "",
    })),
    wishItems: (orderInput.wishItems || []).map((item) => ({
      name: item.name,
      note: item.note || "",
    })),
    note: orderInput.note || "",
  };
}

function buildDraftOrderItem(item, index) {
  const menuItem = MENU_ITEMS.find((candidate) => candidate.id === item.menuItemId && !candidate.hidden);
  if (!menuItem) {
    throw new Error("菜品不存在或不可见");
  }

  return {
    id: `draft_item_${index + 1}`,
    menuItemId: menuItem.id,
    name: menuItem.name,
    quantity: item.quantity || 1,
    note: item.note || "",
    replacementForItemId: null,
  };
}

function getCatStatusTitle(status, order, pendingReplacementRequest) {
  if (
    status === ORDER_STATUS.REPLACEMENT_REQUESTED &&
    !pendingReplacementRequest &&
    hasConfirmedReplacementRequest(order)
  ) {
    return "咪同意换啦，等主人接单";
  }

  return getStatusCopy(status, ROLE.CAT);
}

function getCatStatusDetail(status, order, pendingReplacementRequest) {
  if (
    status === ORDER_STATUS.REPLACEMENT_REQUESTED &&
    !pendingReplacementRequest &&
    hasConfirmedReplacementRequest(order)
  ) {
    return "主人收到后就会继续安排。";
  }

  const details = {
    [ORDER_STATUS.SUBMITTED]: "已经发给主人，等主人看一下。",
    [ORDER_STATUS.ACCEPTED]: "主人接住了，咪可以等饭。",
    [ORDER_STATUS.COOKING]: "主人开火啦，咪可以准备靠近厨房。",
    [ORDER_STATUS.COMPLETED]: "主人说做好了，咪可以去吃。",
    [ORDER_STATUS.CANCELLED]: "这单先不算啦，咪可以重新点。",
    [ORDER_STATUS.REPLACEMENT_REQUESTED]: "主人想换一道，等咪确认。",
  };

  return details[status] || "";
}

function hasConfirmedReplacementRequest(order) {
  return (order.replacementRequests || []).some((request) => request.status === "confirmed");
}

function removeStorage(storage, key) {
  if (typeof storage.removeStorageSync === "function") {
    storage.removeStorageSync(key);
    return;
  }

  storage.setStorageSync(key, undefined);
}

module.exports = {
  buildCatOrderView,
  buildEmptyCatOrderView,
  createCatOrderDraft,
  hasLatestCatOrder,
  loadLatestCatOrder,
  sendCatOrderDraft,
};
