const {
  MEAL_TIME_LABELS,
  MOOD_LABELS,
  ORDER_STATUS,
  ROLE,
} = require("./constants");
const { createCatOrderDraft } = require("./cat-order-view-model");
const { getStatusCopy } = require("./order-state");

function buildCatOrderHistoryView({ orders = [] }) {
  const decoratedOrders = orders
    .filter((order) => order.status === ORDER_STATUS.COMPLETED)
    .map((order) => ({
      ...order,
      itemsText: order.itemNames.join("、"),
      mealTimeText: MEAL_TIME_LABELS[order.mealTime] || order.mealTime,
      moodText: MOOD_LABELS[order.mood] || order.mood,
      repeatLabel: "再来一份",
      statusText: getStatusCopy(order.status, ROLE.CAT),
    }));

  return {
    emptyNote: "等主人做完一单，这里就会留下咪吃过的菜单。",
    emptyTitle: "咪还没有历史菜单",
    hasOrders: decoratedOrders.length > 0,
    heroSubtitle: "吃过觉得安心的，可以直接再来一份。",
    heroTitle: decoratedOrders.length ? `咪吃过 ${decoratedOrders.length} 顿` : "还没有吃过的记录",
    orders: decoratedOrders,
  };
}

async function loadCatOrderHistory({ api }) {
  await api.wechatLogin({
    code: "dev-code",
    devRoleOverride: ROLE.CAT,
  });

  const response = await api.listOrders({ scope: "history" });
  return buildCatOrderHistoryView({ orders: response.orders });
}

async function createRepeatOrderDraft({ api, storage, orderId }) {
  await api.wechatLogin({
    code: "dev-code",
    devRoleOverride: ROLE.CAT,
  });

  const repeatInput = await api.createRepeatDraft(orderId);
  const draft = createCatOrderDraft(repeatInput);
  storage.setStorageSync("draftOrder", draft);
  return draft;
}

module.exports = {
  buildCatOrderHistoryView,
  createRepeatOrderDraft,
  loadCatOrderHistory,
};
