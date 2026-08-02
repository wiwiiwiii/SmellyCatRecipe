const test = require("node:test");
const assert = require("node:assert/strict");

const { MENU_ITEMS } = require("../data/menu");
const {
  calculateOrderTotal,
  createOrder,
  formatOrderMessage,
  getFeaturedMenu,
} = require("../services/order-service");

test("groups menu items by Chinese category labels", () => {
  const grouped = getFeaturedMenu(MENU_ITEMS);

  assert.equal(grouped[0].name, "暖心主菜");
  assert.equal(grouped[0].items[0].name, "番茄炒蛋盖饭");
});

test("creates a dinner order with Chinese status and cooking estimate", () => {
  const order = createOrder({
    dinerName: "咪",
    mealTime: "今天晚饭",
    selectedDishIds: ["tomato-egg-rice", "cola-chicken-wing"],
    note: "少辣，多放葱",
  });

  assert.equal(order.statusText, "等主人看一下");
  assert.equal(order.dinerName, "咪");
  assert.equal(order.items.length, 2);
  assert.equal(calculateOrderTotal(order.items), 43);
});

test("formats an order message that can be copied to WeChat", () => {
  const order = createOrder({
    dinerName: "咪",
    mealTime: "今天晚饭",
    selectedDishIds: ["tomato-egg-rice"],
    note: "米饭少一点",
  });

  const message = formatOrderMessage(order);

  assert.match(message, /咪的喂食器点餐单/);
  assert.match(message, /今天晚饭/);
  assert.match(message, /番茄炒蛋盖饭/);
  assert.match(message, /米饭少一点/);
});
