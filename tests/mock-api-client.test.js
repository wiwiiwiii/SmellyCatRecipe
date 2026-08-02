const test = require("node:test");
const assert = require("node:assert/strict");

const { createMockApiClient } = require("../services/mock-api-client");

test("mock login returns a role-shaped API response", async () => {
  const api = createMockApiClient();
  const response = await api.wechatLogin({
    code: "dev-code",
    devRoleOverride: "cat",
  });

  assert.equal(response.user.role, "cat");
  assert.equal(response.user.displayName, "咪");
  assert.ok(response.token);
});

test("mock order creation follows API contract and starts submitted", async () => {
  const api = createMockApiClient();
  await api.wechatLogin({ code: "dev-code", devRoleOverride: "cat" });

  const response = await api.createOrder({
    mealTime: "dinner",
    mood: "tired",
    items: [{ menuItemId: "tomato-egg-rice", quantity: 1, note: "米饭少一点" }],
    wishItems: [{ name: "咖喱猪排饭", note: "如果主人方便的话" }],
    note: "今天想吃热一点",
  });

  assert.equal(response.order.status, "submitted");
  assert.equal(response.order.items[0].name, "番茄炒蛋盖饭");
  assert.equal(response.order.wishItems[0].name, "咖喱猪排饭");
  assert.equal(response.order.events[0].type, "submitted");
});

test("mock repeat draft returns editable order input", async () => {
  const api = createMockApiClient();
  await api.wechatLogin({ code: "dev-code", devRoleOverride: "cat" });
  const created = await api.createOrder({
    mealTime: "dinner",
    mood: "tired",
    items: [{ menuItemId: "tomato-egg-rice", quantity: 1 }],
    wishItems: [],
    note: "少一点米饭",
  });

  const draft = await api.createRepeatDraft(created.order.id);

  assert.equal(draft.mealTime, "dinner");
  assert.equal(draft.items[0].menuItemId, "tomato-egg-rice");
  assert.equal(draft.note, "少一点米饭");
});
