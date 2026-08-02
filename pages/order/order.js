const { getDevApiClient } = require("../../services/dev-api-client");
const {
  buildCatOrderView,
  buildEmptyCatOrderView,
  loadLatestCatOrder,
  sendCatOrderDraft,
} = require("../../services/cat-order-view-model");

const api = getDevApiClient();

Page({
  data: {
    hasOrder: false,
    hasNotificationWarning: false,
    hasUnreadUpdate: false,
    hasWishItems: false,
    canSend: false,
    isDraft: false,
    mealTimeText: "",
    message: "",
    moodText: "",
    order: null,
    statusDetail: "",
    statusLabel: "",
    statusCopy: "",
    statusTitle: "",
    unreadLabel: "",
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
      await this.markCatUpdateRead(order, view);
    } catch (error) {
      wx.showToast({
        title: error.message,
        icon: "none",
      });
      this.setData(buildEmptyCatOrderView());
    }
  },

  async sendOrderToOwner() {
    try {
      const response = await sendCatOrderDraft({ api, storage: wx });
      const view = buildCatOrderView(response.order);
      this.setData({
        hasOrder: true,
        ...view,
      });
      wx.showToast({
        title: "已发给主人",
        icon: "success",
      });
    } catch (error) {
      wx.showToast({
        title: error.message,
        icon: "none",
      });
    }
  },

  async markCatUpdateRead(order, view) {
    if (!order || order.isDraft || !view.hasUnreadUpdate || typeof api.markOrderRead !== "function") {
      return;
    }

    try {
      await api.markOrderRead(order.id, "cat");
    } catch (error) {
      wx.showToast({
        title: error.message,
        icon: "none",
      });
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
