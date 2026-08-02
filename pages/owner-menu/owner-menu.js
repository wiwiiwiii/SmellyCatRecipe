const { CATEGORIES } = require("../../data/menu");
const {
  MEAL_TIME,
  MEAL_TIME_LABELS,
  MOOD,
  MOOD_LABELS,
  ROLE,
} = require("../../services/constants");
const { getDevApiClient } = require("../../services/dev-api-client");
const {
  buildOwnerMenuItemInput,
  buildOwnerMenuView,
} = require("../../services/owner-menu-view-model");

const api = getDevApiClient();
const MEAL_TIME_VALUES = [MEAL_TIME.LUNCH, MEAL_TIME.DINNER, MEAL_TIME.LATE_NIGHT];
const MOOD_VALUES = [MOOD.HUNGRY, MOOD.HOT, MOOD.MEAT, MOOD.SWEET, MOOD.TIRED, MOOD.OWNER_PICK];
const DEFAULT_FORM = {
  name: "",
  description: "",
  catReason: "",
  category: "main",
  tagsText: "",
  recommendedMealTimes: [MEAL_TIME.DINNER],
  recommendedMoods: [MOOD.TIRED],
  estimatedMinutes: "15",
  hidden: false,
};

Page({
  data: {
    categories: [],
    editingItemId: "",
    emptyNote: "",
    emptyTitle: "",
    form: { ...DEFAULT_FORM },
    formTitle: "加一道给主人会做的",
    hasItems: false,
    heroSubtitle: "",
    heroTitle: "",
    isLoading: false,
    items: [],
    mealTimes: [],
    moods: [],
  },

  onLoad() {
    this.syncFormOptions(this.data.form);
  },

  async onShow() {
    await this.refreshMenu();
  },

  async refreshMenu() {
    this.setData({ isLoading: true });

    try {
      await api.wechatLogin({
        code: "dev-code",
        devRoleOverride: ROLE.OWNER,
      });
      const response = await api.listMenuItems({ includeHidden: true });
      const view = buildOwnerMenuView({ items: response.items });
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

  onFormInput(event) {
    const field = event.currentTarget.dataset.field;
    this.updateForm({
      [field]: event.detail.value,
    });
  },

  selectCategory(event) {
    this.updateForm({
      category: event.currentTarget.dataset.value,
    });
  },

  toggleMealTime(event) {
    const value = event.currentTarget.dataset.value;
    const nextValues = toggleValue(this.data.form.recommendedMealTimes, value);
    this.updateForm({
      recommendedMealTimes: nextValues,
    });
  },

  toggleMood(event) {
    const value = event.currentTarget.dataset.value;
    const nextValues = toggleValue(this.data.form.recommendedMoods, value);
    this.updateForm({
      recommendedMoods: nextValues,
    });
  },

  toggleFormHidden() {
    this.updateForm({
      hidden: !this.data.form.hidden,
    });
  },

  editMenuItem(event) {
    const itemId = event.currentTarget.dataset.id;
    const item = this.data.items.find((candidate) => candidate.id === itemId);
    if (!item) return;

    const form = {
      name: item.name,
      description: item.description,
      catReason: item.catReason,
      category: item.category || item.categoryId,
      tagsText: item.tags.join("，"),
      recommendedMealTimes: item.recommendedMealTimes,
      recommendedMoods: item.recommendedMoods,
      estimatedMinutes: String(item.estimatedMinutes || item.cookingMinutes || 15),
      hidden: item.hidden,
    };

    this.setData({
      editingItemId: item.id,
      form,
      formTitle: "改一下这道菜",
    });
    this.syncFormOptions(form);
  },

  resetForm() {
    const form = { ...DEFAULT_FORM };
    this.setData({
      editingItemId: "",
      form,
      formTitle: "加一道给主人会做的",
    });
    this.syncFormOptions(form);
  },

  async saveMenuItem() {
    try {
      const input = buildOwnerMenuItemInput(this.data.form);
      validateMenuInput(input);
      await api.wechatLogin({
        code: "dev-code",
        devRoleOverride: ROLE.OWNER,
      });

      if (this.data.editingItemId) {
        await api.updateMenuItem(this.data.editingItemId, input);
      } else {
        await api.createMenuItem(input);
      }

      wx.showToast({
        title: this.data.editingItemId ? "已更新" : "已加入菜单",
        icon: "success",
      });
      this.resetForm();
      await this.refreshMenu();
    } catch (error) {
      wx.showToast({
        title: error.message,
        icon: "none",
      });
    }
  },

  async toggleMenuVisibility(event) {
    const itemId = event.currentTarget.dataset.id;
    const item = this.data.items.find((candidate) => candidate.id === itemId);
    if (!item) return;

    try {
      await api.wechatLogin({
        code: "dev-code",
        devRoleOverride: ROLE.OWNER,
      });
      await api.updateMenuItem(itemId, {
        hidden: !item.hidden,
      });
      await this.refreshMenu();
    } catch (error) {
      wx.showToast({
        title: error.message,
        icon: "none",
      });
    }
  },

  backOwner() {
    wx.navigateBack({
      delta: 1,
    });
  },

  updateForm(patch) {
    const form = {
      ...this.data.form,
      ...patch,
    };
    this.setData({ form });
    this.syncFormOptions(form);
  },

  syncFormOptions(form) {
    this.setData({
      categories: CATEGORIES.map((category) => ({
        value: category.id,
        label: category.name,
        selected: form.category === category.id,
      })),
      mealTimes: MEAL_TIME_VALUES.map((value) => ({
        value,
        label: MEAL_TIME_LABELS[value],
        selected: form.recommendedMealTimes.includes(value),
      })),
      moods: MOOD_VALUES.map((value) => ({
        value,
        label: MOOD_LABELS[value],
        selected: form.recommendedMoods.includes(value),
      })),
    });
  },
});

function toggleValue(values, value) {
  const selected = new Set(values);
  if (selected.has(value)) {
    selected.delete(value);
  } else {
    selected.add(value);
  }
  return Array.from(selected);
}

function validateMenuInput(input) {
  if (!input.name || !input.description || !input.catReason) {
    throw new Error("菜名、描述和给咪看的理由都要写");
  }
  if (!input.recommendedMealTimes.length) {
    throw new Error("至少选一个餐次");
  }
  if (!input.recommendedMoods.length) {
    throw new Error("至少选一个状态");
  }
  if (!Number.isFinite(input.estimatedMinutes) || input.estimatedMinutes <= 0) {
    throw new Error("预计分钟要填正数");
  }
}
