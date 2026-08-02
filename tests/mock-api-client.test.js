const test = require("node:test");
const assert = require("node:assert/strict");

const { ROLE } = require("../services/constants");
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
  assert.equal(response.order.unreadByRoles.owner, true);
  assert.equal(response.order.unreadByRoles.cat, false);
});

test("mock unread markers belong to the opposite role and clear after reading", async () => {
  const api = createMockApiClient();
  await api.wechatLogin({ code: "dev-code", devRoleOverride: ROLE.CAT });

  const created = await api.createOrder({
    mealTime: "dinner",
    mood: "tired",
    items: [{ menuItemId: "tomato-egg-rice", quantity: 1 }],
    wishItems: [],
    note: "少一点米饭",
  });

  await api.wechatLogin({ code: "dev-code", devRoleOverride: ROLE.OWNER });
  const unreadOwnerList = await api.listOrders({ scope: "current" });
  assert.equal(unreadOwnerList.orders[0].hasUnreadUpdate, true);

  const ownerRead = await api.markOrderRead(created.order.id, ROLE.OWNER);
  const readOwnerList = await api.listOrders({ scope: "current" });
  assert.equal(ownerRead.order.unreadByRoles.owner, false);
  assert.equal(readOwnerList.orders[0].hasUnreadUpdate, false);

  const accepted = await api.acceptOrder(created.order.id);
  assert.equal(accepted.order.unreadByRoles.cat, true);
  assert.equal(accepted.order.unreadByRoles.owner, false);

  await api.wechatLogin({ code: "dev-code", devRoleOverride: ROLE.CAT });
  const catRead = await api.markOrderRead(created.order.id, ROLE.CAT);
  assert.equal(catRead.order.unreadByRoles.cat, false);
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
