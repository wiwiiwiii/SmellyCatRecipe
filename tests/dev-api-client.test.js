const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getDevApiClient,
  resetDevApiClient,
} = require("../services/dev-api-client");

test("dev api client keeps cat-created orders visible to owner flow", async () => {
  resetDevApiClient();

  const api = getDevApiClient();
  await api.wechatLogin({
    code: "dev-code",
    devRoleOverride: "cat",
  });

  const created = await api.createOrder({
    mealTime: "dinner",
    mood: "tired",
    items: [{ menuItemId: "tomato-egg-rice", quantity: 1 }],
    wishItems: [],
    note: "少一点米饭",
  });

  await api.wechatLogin({
    code: "dev-code",
    devRoleOverride: "owner",
  });

  const list = await api.listOrders({ scope: "current" });
  assert.equal(list.orders.length, 1);
  assert.equal(list.orders[0].id, created.order.id);
  assert.equal(list.orders[0].status, "submitted");
});
