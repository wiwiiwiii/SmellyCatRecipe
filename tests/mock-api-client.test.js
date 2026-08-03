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

test("mock replacement request waits for cat confirmation before owner can accept", async () => {
  const api = createMockApiClient();
  await api.wechatLogin({ code: "dev-code", devRoleOverride: ROLE.CAT });

  const created = await api.createOrder({
    mealTime: "dinner",
    mood: "tired",
    items: [{ menuItemId: "tomato-egg-rice", quantity: 1 }],
    wishItems: [],
    note: "少一点米饭",
  });
  const originalItemId = created.order.items[0].id;

  await api.wechatLogin({ code: "dev-code", devRoleOverride: ROLE.OWNER });
  const requested = await api.requestReplacement(created.order.id, {
    replacements: [
      {
        originalItemId,
        replacementMenuItemId: "beef-udon",
        reason: "主人想换成热乎的乌冬，咪看一下好不好。",
      },
    ],
  });

  assert.equal(requested.order.status, "replacement_requested");
  assert.equal(requested.order.replacementRequests[0].status, "pending");
  assert.equal(requested.order.replacementRequests[0].replacements[0].replacementMenuItemName, "肥牛乌冬面");
  assert.equal(requested.order.unreadByRoles.cat, true);
  await assert.rejects(() => api.acceptOrder(created.order.id), /替换还没有得到咪确认/);

  await api.wechatLogin({ code: "dev-code", devRoleOverride: ROLE.CAT });
  const confirmed = await api.confirmReplacement(
    created.order.id,
    requested.order.replacementRequests[0].id,
    { note: "可以，咪想吃热乎的" },
  );

  assert.equal(confirmed.order.status, "replacement_requested");
  assert.equal(confirmed.order.replacementRequests[0].status, "confirmed");
  assert.equal(confirmed.order.items[0].name, "肥牛乌冬面");
  assert.equal(confirmed.order.items[0].replacementForItemId, originalItemId);
  assert.equal(confirmed.order.unreadByRoles.owner, true);

  await api.wechatLogin({ code: "dev-code", devRoleOverride: ROLE.OWNER });
  const ownerList = await api.listOrders({ scope: "current" });
  assert.equal(ownerList.orders[0].replacementRequests[0].status, "confirmed");

  const accepted = await api.acceptOrder(created.order.id);
  assert.equal(accepted.order.status, "accepted");
});

test("owner and cat can cancel active orders and notify the other side", async () => {
  const api = createMockApiClient();
  await api.wechatLogin({ code: "dev-code", devRoleOverride: ROLE.CAT });
  const ownerCancelledOrder = await api.createOrder({
    mealTime: "dinner",
    mood: "tired",
    items: [{ menuItemId: "tomato-egg-rice", quantity: 1 }],
    wishItems: [],
    note: "少一点米饭",
  });
  const catCancelledOrder = await api.createOrder({
    mealTime: "lunch",
    mood: "hungry",
    items: [{ menuItemId: "beef-udon", quantity: 1 }],
    wishItems: [],
    note: "",
  });

  await api.wechatLogin({ code: "dev-code", devRoleOverride: ROLE.OWNER });
  const ownerCancelled = await api.cancelOrder(ownerCancelledOrder.order.id, { note: "主人今天来不及做" });
  assert.equal(ownerCancelled.order.status, "cancelled");
  assert.equal(ownerCancelled.order.unreadByRoles.cat, true);
  assert.equal(ownerCancelled.order.unreadByRoles.owner, false);

  await api.wechatLogin({ code: "dev-code", devRoleOverride: ROLE.CAT });
  const catCancelled = await api.cancelOrder(catCancelledOrder.order.id, { note: "咪不吃了" });
  assert.equal(catCancelled.order.status, "cancelled");
  assert.equal(catCancelled.order.unreadByRoles.owner, true);
  assert.equal(catCancelled.order.unreadByRoles.cat, false);

  const current = await api.listOrders({ scope: "current" });
  const history = await api.listOrders({ scope: "history" });
  assert.equal(current.orders.length, 0);
  assert.equal(history.orders.length, 2);
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

test("mock history lists completed orders for cat repeat flow", async () => {
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
  await api.acceptOrder(created.order.id);
  await api.startCooking(created.order.id);
  await api.completeOrder(created.order.id);

  await api.wechatLogin({ code: "dev-code", devRoleOverride: ROLE.CAT });
  const current = await api.listOrders({ scope: "current" });
  const history = await api.listOrders({ scope: "history" });

  assert.equal(current.orders.length, 0);
  assert.equal(history.orders.length, 1);
  assert.equal(history.orders[0].id, created.order.id);
  assert.equal(history.orders[0].status, "completed");
});

test("owner can create menu items that cat can later see", async () => {
  const api = createMockApiClient();
  await api.wechatLogin({ code: "dev-code", devRoleOverride: ROLE.OWNER });

  const created = await api.createMenuItem({
    name: "葱油拌面",
    description: "香香的葱油和热面条。",
    catReason: "咪想吃简单但很香的一碗。",
    category: "main",
    tags: ["快手", "面"],
    recommendedMealTimes: ["lunch", "dinner"],
    recommendedMoods: ["hungry", "tired"],
    estimatedMinutes: 12,
    hidden: false,
  });

  await api.wechatLogin({ code: "dev-code", devRoleOverride: ROLE.CAT });
  const catMenu = await api.listMenuItems({ q: "葱油" });

  assert.equal(created.item.name, "葱油拌面");
  assert.equal(created.item.hidden, false);
  assert.equal(catMenu.items.length, 1);
  assert.equal(catMenu.items[0].id, created.item.id);
});

test("owner can hide and restore a menu item from cat menu", async () => {
  const api = createMockApiClient();
  await api.wechatLogin({ code: "dev-code", devRoleOverride: ROLE.OWNER });

  const hidden = await api.updateMenuItem("tomato-egg-rice", { hidden: true });
  const ownerMenu = await api.listMenuItems({ includeHidden: true, q: "番茄" });

  await api.wechatLogin({ code: "dev-code", devRoleOverride: ROLE.CAT });
  const hiddenCatMenu = await api.listMenuItems({ q: "番茄" });

  await api.wechatLogin({ code: "dev-code", devRoleOverride: ROLE.OWNER });
  const restored = await api.updateMenuItem("tomato-egg-rice", { hidden: false });

  await api.wechatLogin({ code: "dev-code", devRoleOverride: ROLE.CAT });
  const restoredCatMenu = await api.listMenuItems({ q: "番茄" });

  assert.equal(hidden.item.hidden, true);
  assert.equal(ownerMenu.items[0].hidden, true);
  assert.equal(hiddenCatMenu.items.length, 0);
  assert.equal(restored.item.hidden, false);
  assert.equal(restoredCatMenu.items.length, 1);
});

test("cat cannot create or edit menu items", async () => {
  const api = createMockApiClient();
  await api.wechatLogin({ code: "dev-code", devRoleOverride: ROLE.CAT });

  await assert.rejects(
    () => api.createMenuItem({
      name: "偷偷加菜",
      description: "不该成功",
      catReason: "不该成功",
      category: "main",
      tags: [],
      recommendedMealTimes: ["dinner"],
      recommendedMoods: ["tired"],
      estimatedMinutes: 10,
      hidden: false,
    }),
    /当前角色不能执行操作/,
  );
  await assert.rejects(
    () => api.updateMenuItem("tomato-egg-rice", { hidden: true }),
    /当前角色不能执行操作/,
  );
});
