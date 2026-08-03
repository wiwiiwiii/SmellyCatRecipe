const { ROLE } = require("../../services/constants");
const { getDevApiClient } = require("../../services/dev-api-client");
const {
  buildOwnerOrderDetailView,
  buildOwnerOrderListView,
  resolveOwnerActiveOrderId,
} = require("../../services/owner-view-model");

const api = getDevApiClient();

Page({
  data: {
    activeOrderId: "",
    detail: null,
    emptyNote: "",
    emptyTitle: "",
    hasActiveOrder: false,
    hasOrders: false,
    heroSubtitle: "",
    heroTitle: "",
    isLoading: false,
    menuItems: [],
    orders: [],
  },

  async onShow() {
    await this.refreshOwnerOrders();
  },

  async refreshOwnerOrders() {
    this.setData({ isLoading: true });

    try {
      await api.wechatLogin({
        code: "dev-code",
        devRoleOverride: ROLE.OWNER,
      });

      const response = await api.listOrders({ scope: "current" });
      const menuResponse = await api.listMenuItems({});
      const listView = buildOwnerOrderListView({ orders: response.orders });
      const activeOrderId = resolveOwnerActiveOrderId({
        orders: listView.orders,
        preferredOrderId: this.data.activeOrderId,
      });

      this.setData({
        ...listView,
        activeOrderId,
        menuItems: menuResponse.items,
        orders: markActiveOrder(listView.orders, activeOrderId),
      });

      if (activeOrderId) {
        await this.loadOrderDetail(activeOrderId);
      } else {
        this.setData({
          detail: null,
          hasActiveOrder: false,
        });
      }
    } catch (error) {
      wx.showToast({
        title: error.message,
        icon: "none",
      });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  async selectOrder(event) {
    const orderId = event.currentTarget.dataset.id;
    this.setData({
      activeOrderId: orderId,
      orders: markActiveOrder(this.data.orders, orderId),
    });
    await this.loadOrderDetail(orderId);
  },

  async loadOrderDetail(orderId) {
    const response = await api.getOrder(orderId);
    const detail = buildOwnerOrderDetailView({
      order: response.order,
      menuItems: this.data.menuItems,
    });

    this.setData({
      detail,
      hasActiveOrder: true,
    });

    if (detail.hasUnreadUpdate && typeof api.markOrderRead === "function") {
      await api.markOrderRead(orderId, ROLE.OWNER);
      this.setData({
        orders: clearUnreadOrder(this.data.orders, orderId),
      });
    }
  },

  async runPrimaryAction() {
    if (!this.data.detail || !this.data.detail.primaryAction) {
      wx.showToast({
        title: "这单暂时不用操作",
        icon: "none",
      });
      return;
    }

    const orderId = this.data.detail.order.id;
    const { action } = this.data.detail.primaryAction;

    try {
      if (action === "accept") {
        await api.acceptOrder(orderId);
      } else if (action === "start_cooking") {
        await api.startCooking(orderId);
      } else if (action === "complete") {
        await api.completeOrder(orderId);
      }

      wx.showToast({
        title: "主人处理好了",
        icon: "success",
      });
      await this.refreshOwnerOrders();
    } catch (error) {
      wx.showToast({
        title: error.message,
        icon: "none",
      });
    }
  },

  async requestReplacement(event) {
    if (!this.data.detail || !this.data.detail.order) {
      wx.showToast({
        title: "先选一单",
        icon: "none",
      });
      return;
    }

    const { originalId, replacementId, replacementName } = event.currentTarget.dataset;

    try {
      await api.wechatLogin({
        code: "dev-code",
        devRoleOverride: ROLE.OWNER,
      });
      await api.requestReplacement(this.data.detail.order.id, {
        replacements: [
          {
            originalItemId: originalId,
            replacementMenuItemId: replacementId,
            reason: `主人想换成${replacementName}，咪看一下好不好。`,
          },
        ],
      });

      wx.showToast({
        title: "已问咪",
        icon: "success",
      });
      await this.refreshOwnerOrders();
    } catch (error) {
      wx.showToast({
        title: error.message,
        icon: "none",
      });
    }
  },

  async cancelOrder() {
    if (!this.data.detail || !this.data.detail.order || !this.data.detail.canCancel) {
      wx.showToast({
        title: "这单不能取消了",
        icon: "none",
      });
      return;
    }

    try {
      await api.wechatLogin({
        code: "dev-code",
        devRoleOverride: ROLE.OWNER,
      });
      await api.cancelOrder(this.data.detail.order.id, {
        note: "主人取消了这单",
      });

      wx.showToast({
        title: "已取消",
        icon: "success",
      });
      await this.refreshOwnerOrders();
    } catch (error) {
      wx.showToast({
        title: error.message,
        icon: "none",
      });
    }
  },

  goCatMenu() {
    wx.navigateBack({
      delta: 1,
    });
  },

  goOwnerMenu() {
    wx.navigateTo({
      url: "/pages/owner-menu/owner-menu",
    });
  },
});

function markActiveOrder(orders, activeOrderId) {
  return orders.map((order) => ({
    ...order,
    isActive: order.id === activeOrderId,
  }));
}

function clearUnreadOrder(orders, orderId) {
  return orders.map((order) => {
    if (order.id !== orderId) return order;
    return {
      ...order,
      hasUnreadUpdate: false,
      unreadLabel: "",
    };
  });
}
