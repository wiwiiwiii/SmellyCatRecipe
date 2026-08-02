const test = require("node:test");
const assert = require("node:assert/strict");

const { ORDER_STATUS } = require("../services/constants");
const {
  getDevApiClient,
  resetDevApiClient,
} = require("../services/dev-api-client");
const {
  buildCatOrderView,
  hasLatestCatOrder,
  loadLatestCatOrder,
} = require("../services/cat-order-view-model");

test("cat order page loads owner-updated status from api instead of stale storage", async () => {
  resetDevApiClient();

  const api = getDevApiClient();
  const storage = createMemoryStorage();

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

  storage.setStorageSync("latestOrderId", created.order.id);
  storage.setStorageSync("latestOrder", created.order);

  await api.wechatLogin({
    code: "dev-code",
    devRoleOverride: "owner",
  });
  await api.acceptOrder(created.order.id);

  const loaded = await loadLatestCatOrder({ api, storage });
  const view = buildCatOrderView(loaded.order);

  assert.equal(loaded.order.status, ORDER_STATUS.ACCEPTED);
  assert.equal(storage.getStorageSync("latestOrder").status, ORDER_STATUS.ACCEPTED);
  assert.equal(view.statusCopy, "主人收到啦，咪等一下");
  assert.equal(view.hasEvents, undefined);
});

test("cat menu can detect whether there is a latest order to revisit", () => {
  const emptyStorage = createMemoryStorage();
  const filledStorage = createMemoryStorage();
  filledStorage.setStorageSync("latestOrderId", "ord_0001");

  assert.equal(hasLatestCatOrder(emptyStorage), false);
  assert.equal(hasLatestCatOrder(filledStorage), true);
});

function createMemoryStorage() {
  const state = new Map();
  return {
    getStorageSync(key) {
      return state.get(key);
    },
    setStorageSync(key, value) {
      state.set(key, value);
    },
  };
}
