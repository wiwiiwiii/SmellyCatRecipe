const test = require("node:test");
const assert = require("node:assert/strict");

const { ORDER_STATUS } = require("../services/constants");
const {
  buildCatOrderHistoryView,
  createRepeatOrderDraft,
} = require("../services/order-history-view-model");

test("cat history view lists completed orders with repeat copy", () => {
  const view = buildCatOrderHistoryView({
    orders: [
      {
        id: "ord_0001",
        mealTime: "dinner",
        mood: "tired",
        status: ORDER_STATUS.COMPLETED,
        itemNames: ["番茄炒蛋盖饭", "咖喱猪排饭"],
        createdAt: "2026-08-02T10:20:30.000Z",
        updatedAt: "2026-08-02T11:00:00.000Z",
      },
    ],
  });

  assert.equal(view.hasOrders, true);
  assert.equal(view.heroTitle, "咪吃过 1 顿");
  assert.equal(view.orders[0].mealTimeText, "晚饭");
  assert.equal(view.orders[0].statusText, "可以吃啦，咪快来");
  assert.equal(view.orders[0].itemsText, "番茄炒蛋盖饭、咖喱猪排饭");
  assert.equal(view.orders[0].repeatLabel, "再来一份");
});

test("cat history view has gentle empty copy", () => {
  const view = buildCatOrderHistoryView({ orders: [] });

  assert.equal(view.hasOrders, false);
  assert.equal(view.heroTitle, "还没有吃过的记录");
  assert.equal(view.emptyTitle, "咪还没有历史菜单");
});

test("cat history view only treats completed orders as eaten", () => {
  const view = buildCatOrderHistoryView({
    orders: [
      {
        id: "ord_completed",
        mealTime: "dinner",
        mood: "tired",
        status: ORDER_STATUS.COMPLETED,
        itemNames: ["番茄炒蛋盖饭"],
        createdAt: "2026-08-02T10:20:30.000Z",
        updatedAt: "2026-08-02T11:00:00.000Z",
      },
      {
        id: "ord_cancelled",
        mealTime: "late_night",
        mood: "sweet",
        status: ORDER_STATUS.CANCELLED,
        itemNames: ["芒果酸奶杯"],
        createdAt: "2026-08-02T12:20:30.000Z",
        updatedAt: "2026-08-02T12:30:00.000Z",
      },
    ],
  });

  assert.equal(view.orders.length, 1);
  assert.equal(view.orders[0].id, "ord_completed");
});

test("repeat order creates a draft and does not create an owner-visible order", async () => {
  const calls = {
    repeatOrderId: "",
    createdOrders: 0,
  };
  const api = {
    async wechatLogin(input) {
      assert.equal(input.devRoleOverride, "cat");
      return { user: { role: "cat" } };
    },
    async createRepeatDraft(orderId) {
      calls.repeatOrderId = orderId;
      return {
        mealTime: "dinner",
        mood: "tired",
        items: [{ menuItemId: "tomato-egg-rice", quantity: 1 }],
        wishItems: [{ name: "咖喱猪排饭", note: "如果主人方便的话" }],
        note: "少一点米饭",
      };
    },
    async createOrder() {
      calls.createdOrders += 1;
    },
  };
  const storage = createMemoryStorage();

  const draft = await createRepeatOrderDraft({
    api,
    storage,
    orderId: "ord_0001",
  });

  assert.equal(calls.repeatOrderId, "ord_0001");
  assert.equal(calls.createdOrders, 0);
  assert.equal(draft.previewOrder.isDraft, true);
  assert.equal(draft.previewOrder.items[0].name, "番茄炒蛋盖饭");
  assert.equal(storage.getStorageSync("draftOrder"), draft);
  assert.equal(storage.getStorageSync("latestOrderId"), undefined);
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
