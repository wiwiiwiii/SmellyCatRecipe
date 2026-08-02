const { getDevApiClient } = require("../../services/dev-api-client");
const {
  buildCatOrderView,
  buildEmptyCatOrderView,
  loadLatestCatOrder,
} = require("../../services/cat-order-view-model");

const api = getDevApiClient();

Page({
  data: {
    hasOrder: false,
    hasNotificationWarning: false,
    hasWishItems: false,
    mealTimeText: "",
    message: "",
    moodText: "",
    order: null,
    statusCopy: "",
  },

  async onShow() {
    try {
      const { order } = await loadLatestCatOrder({ api, storage: wx });
      if (!order) {
        this.setData(buildEmptyCatOrderView());
        return;
      }

      const view = buildCatOrderView(order);
      this.setData({
        hasOrder: true,
        ...view,
      });
    } catch (error) {
      wx.showToast({
        title: error.message,
        icon: "none",
      });
      this.setData(buildEmptyCatOrderView());
    }
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
