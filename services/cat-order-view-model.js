const {
  MEAL_TIME_LABELS,
  MOOD_LABELS,
  ORDER_STATUS,
  ROLE,
} = require("./constants");
const { getStatusCopy } = require("./order-state");

async function loadLatestCatOrder({ api, storage }) {
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

function buildCatOrderView(order) {
  const status = order.status || ORDER_STATUS.SUBMITTED;
  const normalizedOrder = {
    ...order,
    status,
  };

  return {
    hasEvents: Array.isArray(order.events) && order.events.length > 0,
    hasNotificationWarning: Boolean(order.notificationSummary && order.notificationSummary.hasWarning),
    hasWishItems: Array.isArray(order.wishItems) && order.wishItems.length > 0,
    mealTimeText: MEAL_TIME_LABELS[order.mealTime] || order.mealTime,
    message: formatCatOrderMessage(normalizedOrder),
    moodText: MOOD_LABELS[order.mood] || "",
    order: normalizedOrder,
    statusCopy: getStatusCopy(status, ROLE.CAT),
  };
}

function buildEmptyCatOrderView() {
  return {
    hasOrder: false,
    hasEvents: false,
    hasNotificationWarning: false,
    hasWishItems: false,
    mealTimeText: "",
    message: "",
    moodText: "",
    order: null,
    statusCopy: "",
  };
}

function hasLatestCatOrder(storage) {
  return Boolean(storage.getStorageSync("latestOrderId"));
}

function formatCatOrderMessage(order) {
  const itemLines = order.items.map((item, index) => {
    return `${index + 1}. ${item.name}${item.note ? `（${item.note}）` : ""}`;
  });
  const wishLines = order.wishItems.map((item, index) => {
    return `愿望 ${index + 1}. ${item.name}${item.note ? `（${item.note}）` : ""}`;
  });

  return [
    "咪的喂食器点餐单",
    `餐次：${MEAL_TIME_LABELS[order.mealTime] || order.mealTime}`,
    `状态：${MOOD_LABELS[order.mood] || order.mood}`,
    ...itemLines,
    ...wishLines,
    `备注：${order.note || "无"}`,
  ].join("\n");
}

function isRenderableOrder(order) {
  return Boolean(order && Array.isArray(order.items) && Array.isArray(order.wishItems) && order.status);
}

module.exports = {
  buildCatOrderView,
  buildEmptyCatOrderView,
  hasLatestCatOrder,
  loadLatestCatOrder,
};
