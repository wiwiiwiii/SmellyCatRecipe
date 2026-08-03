const {
  MEAL_TIME_LABELS,
  MOOD_LABELS,
  ORDER_STATUS,
  ROLE,
} = require("./constants");
const {
  canCancelOrder,
  getStatusCopy,
} = require("./order-state");

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
    statusText: getOwnerStatusText(order, hasPendingReplacementRequest(order)),
    hasUnreadUpdate: Boolean(order.hasUnreadUpdate),
    unreadLabel: order.hasUnreadUpdate ? "新点餐" : "",
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

function buildOwnerOrderDetailView({ order, menuItems = [] }) {
  const hasPendingReplacement = hasPendingReplacementRequest(order);
  const primaryAction = getPrimaryAction(order, hasPendingReplacement);
  const canRequestReplacement = order.status === ORDER_STATUS.SUBMITTED;
  const canCancel = canCancelOrder(order);
  const items = order.items.map((item) => ({
    ...item,
    replacementOptions: canRequestReplacement ? getReplacementOptions(item, menuItems) : [],
  }));

  return {
    canAct: Boolean(primaryAction),
    canCancel,
    canRequestReplacement,
    cancelLabel: canCancel ? "取消这单" : "",
    hasUnreadUpdate: Boolean(order.unreadByRoles && order.unreadByRoles[ROLE.OWNER]),
    hasWishItems: Array.isArray(order.wishItems) && order.wishItems.length > 0,
    items,
    mealTimeText: MEAL_TIME_LABELS[order.mealTime] || order.mealTime,
    moodText: MOOD_LABELS[order.mood] || order.mood,
    order,
    primaryAction,
    statusText: getOwnerStatusText(order, hasPendingReplacement),
    unreadLabel: getOwnerUnreadLabel(order),
  };
}

function getOwnerUnreadLabel(order) {
  if (!(order.unreadByRoles && order.unreadByRoles[ROLE.OWNER])) return "";
  return order.status === ORDER_STATUS.SUBMITTED ? "有新点餐" : "有新进展";
}

function getPrimaryAction(order, hasPendingReplacement) {
  if (order.status === ORDER_STATUS.REPLACEMENT_REQUESTED) {
    if (hasPendingReplacement) return null;
    return ACTIONS_BY_STATUS[ORDER_STATUS.SUBMITTED];
  }

  return ACTIONS_BY_STATUS[order.status] || null;
}

function hasPendingReplacementRequest(order) {
  return (order.replacementRequests || []).some((request) => request.status === "pending");
}

function hasConfirmedReplacementRequest(order) {
  return (order.replacementRequests || []).some((request) => request.status === "confirmed");
}

function getOwnerStatusText(order, hasPendingReplacement) {
  if (
    order.status === ORDER_STATUS.REPLACEMENT_REQUESTED &&
    !hasPendingReplacement &&
    hasConfirmedReplacementRequest(order)
  ) {
    return "咪同意换啦，可以接单";
  }

  return getStatusCopy(order.status, ROLE.OWNER);
}

function getReplacementOptions(orderItem, menuItems) {
  return menuItems
    .filter((item) => !item.hidden && item.id !== orderItem.menuItemId)
    .map((item) => ({
      id: item.id,
      name: item.name,
      actionLabel: `换成${item.name}`,
    }));
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
