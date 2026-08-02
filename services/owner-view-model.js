const {
  MEAL_TIME_LABELS,
  MOOD_LABELS,
  ORDER_STATUS,
  ROLE,
} = require("./constants");
const { getStatusCopy } = require("./order-state");

const ACTIONS_BY_STATUS = {
  [ORDER_STATUS.SUBMITTED]: {
    action: "accept",
    label: "主人收到啦",
  },
  [ORDER_STATUS.ACCEPTED]: {
    action: "start_cooking",
    label: "开始做饭",
  },
  [ORDER_STATUS.COOKING]: {
    action: "complete",
    label: "做好了，叫咪来吃",
  },
};

function buildOwnerOrderListView({ orders = [] }) {
  const decoratedOrders = orders.map((order) => ({
    ...order,
    itemsText: order.itemNames.join("、"),
    mealTimeText: MEAL_TIME_LABELS[order.mealTime] || order.mealTime,
    moodText: MOOD_LABELS[order.mood] || order.mood,
    statusText: getStatusCopy(order.status, ROLE.OWNER),
  }));

  return {
    emptyTitle: "现在没有新的小愿望",
    emptyNote: "主人可以先歇一下，等咪点餐。",
    hasOrders: decoratedOrders.length > 0,
    heroSubtitle: "接单、开火、做好饭，都在这里处理。",
    heroTitle: decoratedOrders.length ? `咪有 ${decoratedOrders.length} 个小愿望` : "主人这边很安静",
    orders: decoratedOrders,
  };
}

function buildOwnerOrderDetailView({ order }) {
  const primaryAction = ACTIONS_BY_STATUS[order.status] || null;

  return {
    canAct: Boolean(primaryAction),
    hasWishItems: Array.isArray(order.wishItems) && order.wishItems.length > 0,
    mealTimeText: MEAL_TIME_LABELS[order.mealTime] || order.mealTime,
    moodText: MOOD_LABELS[order.mood] || order.mood,
    order,
    primaryAction,
    statusText: getStatusCopy(order.status, ROLE.OWNER),
  };
}

function resolveOwnerActiveOrderId({ orders = [], preferredOrderId = "" }) {
  if (preferredOrderId && orders.some((order) => order.id === preferredOrderId)) {
    return preferredOrderId;
  }

  return orders[0] ? orders[0].id : "";
}

module.exports = {
  buildOwnerOrderDetailView,
  buildOwnerOrderListView,
  resolveOwnerActiveOrderId,
};
