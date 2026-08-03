const { ROLE } = require("../../services/constants");
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
    hasPendingReplacement: false,
    hasUnreadUpdate: false,
    hasWishItems: false,
    canConfirmReplacement: false,
    canSend: false,
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

  async confirmReplacement() {
    await this.decideReplacement({
      accept: true,
      note: "可以，咪想吃这个",
    });
  },

  async rejectReplacement() {
    await this.decideReplacement({
      accept: false,
      note: "咪还是想重新点一下",
    });
  },

  async decideReplacement({ accept, note }) {
    if (!this.data.order || !this.data.pendingReplacementRequest) {
      wx.showToast({
        title: "没有要确认的替换",
        icon: "none",
      });
      return;
    }

    try {
      await api.wechatLogin({
        code: "dev-code",
        devRoleOverride: ROLE.CAT,
      });
      const orderId = this.data.order.id;
      const requestId = this.data.pendingReplacementRequest.id;
      const response = accept
        ? await api.confirmReplacement(orderId, requestId, { note })
        : await api.rejectReplacement(orderId, requestId, { nextAction: "cancel", note });
      const view = buildCatOrderView(response.order);

      wx.setStorageSync("latestOrder", response.order);
      this.setData({
        hasOrder: true,
        ...view,
      });
      wx.showToast({
        title: accept ? "咪同意啦" : "咪重新点",
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
