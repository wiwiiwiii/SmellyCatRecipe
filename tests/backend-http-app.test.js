const test = require("node:test");
const assert = require("node:assert/strict");

const { createApp } = require("../backend/http/app");
const { ROLE } = require("../services/constants");

test("backend app exposes a JSON health endpoint", async () => {
  const app = createApp();

  const response = await app.inject({
    method: "GET",
    url: "/health",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    service: "smelly-cat-recipe-api",
    status: "ok",
  });
});

test("backend app exposes development wechat login stub", async () => {
  const app = createApp();

  const response = await app.inject({
    method: "POST",
    url: "/v1/auth/wechat-login",
    body: {
      code: "dev-code",
      devRoleOverride: "owner",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.user.role, "owner");
  assert.equal(response.body.user.displayName, "主人");
  assert.match(response.body.token, /^dev-token-owner-/);
});

test("backend app can resolve authenticated user through auth service token verifier", async () => {
  const app = createApp({
    authService: {
      verifyToken(token) {
        assert.equal(token, "signed-token");
        return {
          id: "usr_cat",
          role: "cat",
          displayName: "咪",
          openidBound: true,
        };
      },
      async wechatLogin() {
        throw new Error("not used");
      },
    },
  });

  const response = await app.inject({
    method: "GET",
    url: "/v1/auth/me",
    headers: bearer("signed-token"),
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.user.displayName, "咪");
});

test("backend app lists visible menu items through repository boundary", async () => {
  const seenFilters = [];
  const app = createApp({
    menuItemsRepository: {
      async list(filters) {
        seenFilters.push(filters);
        return {
          items: [
            {
              id: "tomato-egg-rice",
              category: "main",
              categoryId: "main",
              name: "番茄炒蛋盖饭",
              description: "酸甜番茄汁拌米饭。",
              catReason: "咪觉得这个拌饭会很安心。",
              tags: ["不辣"],
              recommendedMealTimes: ["lunch", "dinner"],
              recommendedMoods: ["hungry"],
              estimatedMinutes: 15,
              cookingMinutes: 15,
              hidden: false,
            },
          ],
          nextCursor: null,
        };
      },
    },
  });

  const response = await app.inject({
    method: "GET",
    url: "/v1/menu-items?mealTime=dinner&q=%E7%95%AA%E8%8C%84",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.items[0].name, "番茄炒蛋盖饭");
  assert.deepEqual(seenFilters[0], {
    includeHidden: false,
    mealTime: "dinner",
    mood: "",
    q: "番茄",
  });
});

test("backend app requires bearer auth for order creation", async () => {
  const app = createApp();

  const response = await app.inject({
    method: "POST",
    url: "/v1/orders",
    body: {
      mealTime: "dinner",
      mood: "tired",
      items: [{ menuItemId: "tomato-egg-rice", quantity: 1 }],
      wishItems: [],
    },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error.code, "AUTH_REQUIRED");
});

test("backend app routes order lifecycle actions with authenticated user", async () => {
  const calls = [];
  const app = createApp({
    apiClient: createRecordingApi(calls),
  });

  const createResponse = await app.inject({
    method: "POST",
    url: "/v1/orders",
    headers: bearer("dev-token-cat-test"),
    body: {
      mealTime: "dinner",
      mood: "tired",
      items: [{ menuItemId: "tomato-egg-rice", quantity: 1 }],
      wishItems: [],
      note: "少一点米饭",
    },
  });
  const listResponse = await app.inject({
    method: "GET",
    url: "/v1/orders?scope=current",
    headers: bearer("dev-token-owner-test"),
  });
  const detailResponse = await app.inject({
    method: "GET",
    url: "/v1/orders/ord_0001",
    headers: bearer("dev-token-cat-test"),
  });
  const readResponse = await app.inject({
    method: "POST",
    url: "/v1/orders/ord_0001/read",
    headers: bearer("dev-token-owner-test"),
  });
  const acceptResponse = await app.inject({
    method: "POST",
    url: "/v1/orders/ord_0001/accept",
    headers: bearer("dev-token-owner-test"),
  });

  assert.equal(createResponse.statusCode, 201);
  assert.equal(listResponse.statusCode, 200);
  assert.equal(detailResponse.statusCode, 200);
  assert.equal(readResponse.statusCode, 200);
  assert.equal(acceptResponse.statusCode, 200);
  assert.deepEqual(calls.map((call) => call.name), [
    "createOrder",
    "listOrders",
    "getOrder",
    "markOrderRead",
    "acceptOrder",
  ]);
  assert.equal(calls[0].user.role, ROLE.CAT);
  assert.equal(calls[1].user.role, ROLE.OWNER);
});

test("backend app routes replacement and cancel actions", async () => {
  const calls = [];
  const app = createApp({
    apiClient: createRecordingApi(calls),
  });

  const requestResponse = await app.inject({
    method: "POST",
    url: "/v1/orders/ord_0001/replacement-requests",
    headers: bearer("dev-token-owner-test"),
    body: {
      replacements: [
        {
          originalItemId: "item_1",
          replacementMenuItemId: "beef-udon",
          reason: "换个热乎的",
        },
      ],
    },
  });
  const confirmResponse = await app.inject({
    method: "POST",
    url: "/v1/orders/ord_0001/replacement-requests/rr_0001/confirm",
    headers: bearer("dev-token-cat-test"),
    body: {
      note: "可以",
    },
  });
  const rejectResponse = await app.inject({
    method: "POST",
    url: "/v1/orders/ord_0001/replacement-requests/rr_0002/reject",
    headers: bearer("dev-token-cat-test"),
    body: {
      nextAction: "cancel",
      note: "不吃了",
    },
  });
  const cancelResponse = await app.inject({
    method: "POST",
    url: "/v1/orders/ord_0001/cancel",
    headers: bearer("dev-token-owner-test"),
    body: {
      note: "主人取消",
    },
  });

  assert.equal(requestResponse.statusCode, 201);
  assert.equal(confirmResponse.statusCode, 200);
  assert.equal(rejectResponse.statusCode, 200);
  assert.equal(cancelResponse.statusCode, 200);
  assert.deepEqual(calls.map((call) => call.name), [
    "requestReplacement",
    "confirmReplacement",
    "rejectReplacement",
    "cancelOrder",
  ]);
});

test("backend app routes owner menu writes and notification endpoints", async () => {
  const calls = [];
  const app = createApp({
    apiClient: createRecordingApi(calls),
  });

  const createMenuResponse = await app.inject({
    method: "POST",
    url: "/v1/menu-items",
    headers: bearer("dev-token-owner-test"),
    body: {
      name: "葱油拌面",
      description: "香香的面。",
      catReason: "咪会安心。",
      category: "main",
      tags: ["快手"],
      recommendedMealTimes: ["dinner"],
      recommendedMoods: ["tired"],
      estimatedMinutes: 12,
      hidden: false,
    },
  });
  const updateMenuResponse = await app.inject({
    method: "PATCH",
    url: "/v1/menu-items/tomato-egg-rice",
    headers: bearer("dev-token-owner-test"),
    body: {
      hidden: true,
    },
  });
  const templatesResponse = await app.inject({
    method: "GET",
    url: "/v1/notification-templates",
    headers: bearer("dev-token-cat-test"),
  });
  const subscriptionResponse = await app.inject({
    method: "POST",
    url: "/v1/notification-subscriptions",
    headers: bearer("dev-token-cat-test"),
    body: {
      sourceAction: "cat_submit_order",
      results: [{ templateKey: "owner_new_order", status: "accept" }],
    },
  });
  const logsResponse = await app.inject({
    method: "GET",
    url: "/v1/notification-logs?orderId=ord_0001",
    headers: bearer("dev-token-owner-test"),
  });

  assert.equal(createMenuResponse.statusCode, 201);
  assert.equal(updateMenuResponse.statusCode, 200);
  assert.equal(templatesResponse.statusCode, 200);
  assert.equal(subscriptionResponse.statusCode, 200);
  assert.equal(logsResponse.statusCode, 200);
  assert.deepEqual(calls.map((call) => call.name), [
    "createMenuItem",
    "updateMenuItem",
    "recordNotificationSubscriptions",
    "listNotificationLogs",
  ]);
});

function bearer(token) {
  return {
    authorization: `Bearer ${token}`,
  };
}

function createRecordingApi(calls) {
  const order = buildOrder();
  return {
    async createMenuItem(input, user) {
      calls.push({ name: "createMenuItem", input, user });
      return { item: { id: "menu_1", ...input } };
    },
    async updateMenuItem(menuItemId, patch, user) {
      calls.push({ name: "updateMenuItem", menuItemId, patch, user });
      return { item: { id: menuItemId, hidden: Boolean(patch.hidden) } };
    },
    async createOrder(input, user) {
      calls.push({ name: "createOrder", input, user });
      return { order };
    },
    async listOrders(input, user) {
      calls.push({ name: "listOrders", input, user });
      return { orders: [{ id: "ord_0001", itemNames: ["番茄炒蛋盖饭"] }], nextCursor: null };
    },
    async getOrder(orderId, user) {
      calls.push({ name: "getOrder", orderId, user });
      return { order };
    },
    async markOrderRead(orderId, user) {
      calls.push({ name: "markOrderRead", orderId, user });
      return { order };
    },
    async createRepeatDraft(orderId, user) {
      calls.push({ name: "createRepeatDraft", orderId, user });
      return { mealTime: "dinner", mood: "tired", items: [], wishItems: [], note: "" };
    },
    async acceptOrder(orderId, user) {
      calls.push({ name: "acceptOrder", orderId, user });
      return { order };
    },
    async startCooking(orderId, user) {
      calls.push({ name: "startCooking", orderId, user });
      return { order };
    },
    async completeOrder(orderId, user) {
      calls.push({ name: "completeOrder", orderId, user });
      return { order };
    },
    async cancelOrder(orderId, input, user) {
      calls.push({ name: "cancelOrder", orderId, input, user });
      return { order };
    },
    async requestReplacement(orderId, input, user) {
      calls.push({ name: "requestReplacement", orderId, input, user });
      return { order, replacementRequest: { id: "rr_0001" } };
    },
    async confirmReplacement(orderId, replacementRequestId, input, user) {
      calls.push({ name: "confirmReplacement", orderId, replacementRequestId, input, user });
      return { order, replacementRequest: { id: replacementRequestId } };
    },
    async rejectReplacement(orderId, replacementRequestId, input, user) {
      calls.push({ name: "rejectReplacement", orderId, replacementRequestId, input, user });
      return { order, replacementRequest: { id: replacementRequestId } };
    },
    async recordNotificationSubscriptions(input, user) {
      calls.push({ name: "recordNotificationSubscriptions", input, user });
      return { recorded: true };
    },
    async listNotificationLogs(input, user) {
      calls.push({ name: "listNotificationLogs", input, user });
      return { logs: [], nextCursor: null };
    },
  };
}

function buildOrder() {
  return {
    id: "ord_0001",
    mealTime: "dinner",
    mood: "tired",
    status: "submitted",
    items: [],
    wishItems: [],
    events: [],
    replacementRequests: [],
    unreadByRoles: { cat: false, owner: true },
    notificationSummary: { hasWarning: false, latestWarning: null },
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
  };
}
