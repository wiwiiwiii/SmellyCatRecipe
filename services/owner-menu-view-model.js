const { CATEGORIES } = require("../data/menu");
const {
  MEAL_TIME_LABELS,
  MOOD_LABELS,
} = require("./constants");

function buildOwnerMenuView({ items = [] }) {
  const decoratedItems = items.map((item) => ({
    ...item,
    categoryText: getCategoryText(item.category || item.categoryId),
    mealTimesText: (item.recommendedMealTimes || []).map((value) => MEAL_TIME_LABELS[value] || value).join("、"),
    moodsText: (item.recommendedMoods || []).map((value) => MOOD_LABELS[value] || value).join("、"),
    tagsText: (item.tags || []).join(" / "),
    visibilityActionLabel: item.hidden ? "恢复显示" : "藏起来",
    visibilityText: item.hidden ? "已藏起来" : "小猫看得到",
  }));

  return {
    emptyNote: "主人可以先加一道常做的菜。",
    emptyTitle: "还没有菜单",
    hasItems: decoratedItems.length > 0,
    heroSubtitle: "新增、编辑、隐藏，都在这里处理。",
    heroTitle: decoratedItems.length ? `主人有 ${decoratedItems.length} 道菜` : "主人还没有菜单",
    items: decoratedItems,
  };
}

function buildOwnerMenuItemInput(form) {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    catReason: form.catReason.trim(),
    category: form.category,
    tags: parseTags(form.tagsText),
    recommendedMealTimes: form.recommendedMealTimes || [],
    recommendedMoods: form.recommendedMoods || [],
    estimatedMinutes: Number(form.estimatedMinutes),
    hidden: Boolean(form.hidden),
  };
}

function getCategoryText(categoryId) {
  const category = CATEGORIES.find((item) => item.id === categoryId);
  return category ? category.name : categoryId;
}

function parseTags(tagsText = "") {
  return tagsText
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

module.exports = {
  buildOwnerMenuItemInput,
  buildOwnerMenuView,
};
