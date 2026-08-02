const {
  MEAL_TIME_LABELS,
  MOOD_LABELS,
  ORDER_STATUS,
  ROLE,
} = require("../../services/constants");
const { getStatusCopy } = require("../../services/order-state");

Page({
  data: {
    hasOrder: false,
    hasEvents: false,
    hasNotificationWarning: false,
    hasWishItems: false,
    mealTimeText: "",
    message: "",
    moodText: "",
    order: null,
    statusCopy: "",
  },

  onShow() {
    const order = wx.getStorageSync("latestOrder");

    if (order && Array.isArray(order.items) && order.status) {
      const view = buildOrderView(order);
      this.setData({
        hasOrder: true,
        ...view,
      });
      return;
    }

    this.setData({
      hasOrder: false,
      hasEvents: false,
      hasNotificationWarning: false,
      hasWishItems: false,
      mealTimeText: "",
      message: "",
      moodText: "",
      order: null,
      statusCopy: "",
    });
  },

  copyOrder() {
    if (!this.data.message) {
      wx.showToast({
        title: "还没有点餐单",
        icon: "none",
      });
      return;
    }

    wx.setClipboardData({
      data: this.data.message,
      success() {
        wx.showToast({
          title: "已复制",
          icon: "success",
        });
      },
    });
  },

  backToMenu() {
    wx.navigateBack({
      delta: 1,
    });
  },
});

function buildOrderView(order) {
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
    message: formatOrderMessage(normalizedOrder),
    moodText: MOOD_LABELS[order.mood] || "",
    order: normalizedOrder,
    statusCopy: getStatusCopy(status, ROLE.CAT),
  };
}

function formatOrderMessage(order) {
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
