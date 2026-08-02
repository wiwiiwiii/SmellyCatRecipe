const { getDevApiClient } = require("../../services/dev-api-client");
const {
  createRepeatOrderDraft,
  loadCatOrderHistory,
} = require("../../services/order-history-view-model");

const api = getDevApiClient();

Page({
  data: {
    emptyNote: "",
    emptyTitle: "",
    hasOrders: false,
    heroSubtitle: "",
    heroTitle: "",
    isLoading: false,
    orders: [],
  },

  async onShow() {
    await this.refreshHistory();
  },

  async refreshHistory() {
    this.setData({ isLoading: true });

    try {
      const view = await loadCatOrderHistory({ api });
      this.setData(view);
    } catch (error) {
      wx.showToast({
        title: error.message,
        icon: "none",
      });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  async repeatOrder(event) {
    const orderId = event.currentTarget.dataset.id;

    try {
      await createRepeatOrderDraft({
        api,
        storage: wx,
        orderId,
      });
      wx.navigateTo({
        url: "/pages/order/order",
      });
    } catch (error) {
      wx.showToast({
        title: error.message,
        icon: "none",
      });
    }
  },

  backToMenu() {
    wx.navigateBack({
      delta: 1,
    });
  },
});
