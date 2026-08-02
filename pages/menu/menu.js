const { MEAL_TIME, MOOD } = require("../../services/constants");
const { getDevApiClient } = require("../../services/dev-api-client");
const {
  buildMenuViewModel,
  createWishItemDraft,
} = require("../../services/menu-view-model");
const {
  createCatOrderDraft,
  hasLatestCatOrder,
} = require("../../services/cat-order-view-model");

const api = getDevApiClient();

Page({
  data: {
    heroSubtitle: "",
    heroTitle: "",
    hasLatestOrder: false,
    mealTime: MEAL_TIME.DINNER,
    mealTimes: [],
    mood: MOOD.TIRED,
    moods: [],
    menuItems: [],
    note: "",
    query: "",
    recommendedItems: [],
    selectedCount: 0,
    selectedItemIds: [],
    showWishPrompt: false,
    totalSelectedCount: 0,
    wishItems: [],
    wishNote: "",
  },

  onLoad() {
    this.refreshViewModel();
  },

  onShow() {
    this.setData({
      hasLatestOrder: hasLatestCatOrder(wx),
    }, () => this.refreshViewModel());
  },

  selectMealTime(event) {
    this.setData(
      {
        mealTime: event.currentTarget.dataset.value,
      },
      () => this.refreshViewModel()
    );
  },

  selectMood(event) {
    this.setData(
      {
        mood: event.currentTarget.dataset.value,
      },
      () => this.refreshViewModel()
    );
  },

  onSearchInput(event) {
    this.setData(
      {
        query: event.detail.value,
      },
      () => this.refreshViewModel()
    );
  },

  toggleDish(event) {
    const itemId = event.currentTarget.dataset.id;
    const selected = new Set(this.data.selectedItemIds);

    if (selected.has(itemId)) {
      selected.delete(itemId);
    } else {
      selected.add(itemId);
    }

    this.setData(
      {
        selectedItemIds: Array.from(selected),
      },
      () => this.refreshViewModel()
    );
  },

  onWishNoteInput(event) {
    this.setData({
      wishNote: event.detail.value,
    });
  },

  onNoteInput(event) {
    this.setData({
      note: event.detail.value,
    });
  },

  addWishItem() {
    const draft = createWishItemDraft({
      query: this.data.query,
      note: this.data.wishNote,
    });

    if (!draft.name) {
      wx.showToast({
        title: "先写下咪想吃什么",
        icon: "none",
      });
      return;
    }

    const wishItems = this.data.wishItems.concat(draft);
    this.setData(
      {
        query: "",
        wishItems,
        wishNote: "",
      },
      () => this.refreshViewModel()
    );
  },

  removeWishItem(event) {
    const index = Number(event.currentTarget.dataset.index);
    const wishItems = this.data.wishItems.filter((_, itemIndex) => itemIndex !== index);
    this.setData(
      {
        wishItems,
      },
      () => this.refreshViewModel()
    );
  },

  async submitOrder() {
    if (this.data.totalSelectedCount === 0) {
      wx.showToast({
        title: "咪还没有选吃的",
        icon: "none",
      });
      return;
    }

    try {
      const draft = createCatOrderDraft({
        mealTime: this.data.mealTime,
        mood: this.data.mood,
        items: this.data.selectedItemIds.map((menuItemId) => ({
          menuItemId,
          quantity: 1,
        })),
        wishItems: this.data.wishItems,
        note: this.data.note,
      });

      wx.setStorageSync("draftOrder", draft);
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

  goOwnerDev() {
    wx.navigateTo({
      url: "/pages/owner/owner",
    });
  },

  goLatestOrder() {
    wx.navigateTo({
      url: "/pages/order/order",
    });
  },

  goHistory() {
    wx.navigateTo({
      url: "/pages/history/history",
    });
  },

  async refreshViewModel() {
    try {
      const response = await api.listMenuItems({});
      const viewModel = buildMenuViewModel({
        mealTime: this.data.mealTime,
        mood: this.data.mood,
        query: this.data.query,
        selectedItemIds: this.data.selectedItemIds,
        menuItems: response.items,
      });

      this.setData({
        heroSubtitle: viewModel.heroSubtitle,
        heroTitle: viewModel.heroTitle,
        mealTimes: viewModel.mealTimes,
        menuItems: response.items,
        moods: viewModel.moods,
        recommendedItems: viewModel.recommendedItems,
        selectedCount: viewModel.selectedCount,
        showWishPrompt: viewModel.showWishPrompt,
        totalSelectedCount: viewModel.selectedCount + this.data.wishItems.length,
      });
    } catch (error) {
      wx.showToast({
        title: error.message,
        icon: "none",
      });
    }
  },
});
