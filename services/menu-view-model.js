const { MENU_ITEMS } = require("../data/menu");
const { MEAL_TIME, MEAL_TIME_LABELS, MOOD, MOOD_LABELS } = require("./constants");

const MEAL_TIMES = [MEAL_TIME.LUNCH, MEAL_TIME.DINNER, MEAL_TIME.LATE_NIGHT];
const MOODS = [MOOD.HUNGRY, MOOD.HOT, MOOD.MEAT, MOOD.SWEET, MOOD.TIRED, MOOD.OWNER_PICK];

function buildMenuViewModel({ mealTime, mood, selectedItemIds = [], query = "", menuItems = MENU_ITEMS }) {
  const selected = new Set(selectedItemIds);
  const recommendedItems = filterVisibleItems(query, menuItems)
    .filter((item) => {
      return item.recommendedMealTimes.includes(mealTime) || item.recommendedMoods.includes(mood);
    })
    .map((item) => decorateItem(item, selected));

  return {
    heroTitle: `咪${MEAL_TIME_LABELS[mealTime]}想吃什么？`,
    heroSubtitle: mood === MOOD.OWNER_PICK ? "没主意也没关系，主人来安排。" : MOOD_LABELS[mood],
    mealTimes: MEAL_TIMES.map((value) => ({ value, label: MEAL_TIME_LABELS[value], selected: value === mealTime })),
    moods: MOODS.map((value) => ({ value, label: MOOD_LABELS[value], selected: value === mood })),
    recommendedItems,
    selectedCount: selectedItemIds.length,
    showWishPrompt: query.trim().length > 0 && searchMenuItems({ query, menuItems }).length === 0,
  };
}

function searchMenuItems({ query, menuItems = MENU_ITEMS }) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return filterVisibleItems("", menuItems).filter((item) => {
    return searchableText(item).includes(normalized);
  });
}

function createWishItemDraft({ query, note = "" }) {
  return {
    name: query.trim(),
    note: note.trim(),
  };
}

function filterVisibleItems(query = "", menuItems = MENU_ITEMS) {
  const normalized = query.trim().toLowerCase();
  return menuItems.filter((item) => {
    if (item.hidden) return false;
    if (!normalized) return true;
    return searchableText(item).includes(normalized);
  });
}

function decorateItem(item, selected) {
  return {
    ...item,
    selected: selected.has(item.id),
    tagsText: item.tags.join(" / "),
    estimatedMinutes: item.estimatedMinutes || item.cookingMinutes,
  };
}

function searchableText(item) {
  return [item.name, item.description, item.catReason, item.tags.join(" ")]
    .join(" ")
    .toLowerCase();
}

module.exports = {
  buildMenuViewModel,
  createWishItemDraft,
  searchMenuItems,
};
