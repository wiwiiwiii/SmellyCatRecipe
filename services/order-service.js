const { CATEGORIES, MENU_ITEMS } = require("../data/menu");

function getFeaturedMenu(menuItems = MENU_ITEMS) {
  return CATEGORIES.map((category) => ({
    ...category,
    items: menuItems.filter((item) => item.categoryId === category.id),
  })).filter((category) => category.items.length > 0);
}

function calculateOrderTotal(items) {
  return items.reduce((total, item) => total + (item.estimatedMinutes || item.cookingMinutes), 0);
}

function createOrder(input, menuItems = MENU_ITEMS) {
  const selectedDishIds = Array.isArray(input.selectedDishIds)
    ? input.selectedDishIds
    : [];
  const selectedSet = new Set(selectedDishIds);
  const items = menuItems.filter((item) => selectedSet.has(item.id));

  if (items.length === 0) {
    throw new Error("至少要选择一道菜");
  }

  if (items.length !== selectedSet.size) {
    throw new Error("点餐单里有不存在的菜品");
  }

  return {
    id: `order-${Date.now()}`,
    createdAt: new Date().toISOString(),
    statusText: "等主人看一下",
    dinerName: normalizeText(input.dinerName, "咪"),
    mealTime: normalizeText(input.mealTime, "今天晚饭"),
    note: normalizeText(input.note, ""),
    items,
    estimatedCookingMinutes: calculateOrderTotal(items),
  };
}

function formatOrderMessage(order) {
  const dishLines = order.items.map((item, index) => {
    return `${index + 1}. ${item.name}（约 ${item.estimatedMinutes || item.cookingMinutes} 分钟）`;
  });
  const note = order.note || "无";

  return [
    "咪的喂食器点餐单",
    `给谁：${order.dinerName}`,
    `餐次：${order.mealTime}`,
    `状态：${order.statusText}`,
    "想吃：",
    ...dishLines,
    `口味备注：${note}`,
    `预计做饭时间：${order.estimatedCookingMinutes} 分钟`,
  ].join("\n");
}

function normalizeText(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

module.exports = {
  calculateOrderTotal,
  createOrder,
  formatOrderMessage,
  getFeaturedMenu,
};
