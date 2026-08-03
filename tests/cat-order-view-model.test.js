const test = require("node:test");
const assert = require("node:assert/strict");

const { ORDER_STATUS } = require("../services/constants");
const {
  getDevApiClient,
  resetDevApiClient,
} = require("../services/dev-api-client");
const {
  buildCatOrderView,
  createCatOrderDraft,
  hasLatestCatOrder,
  loadLatestCatOrder,
  sendCatOrderDraft,
} = require("../services/cat-order-view-model");

test("cat can generate a menu draft before sending it to owner", async () => {
  resetDevApiClient();

  const api = getDevApiClient();
  const storage = createMemoryStorage();
  const draft = createCatOrderDraft({
    mealTime: "dinner",
    mood: "tired",
    items: [{ menuItemId: "tomato-egg-rice", quantity: 1 }],
    wishItems: [{ name: "咖喱猪排饭", note: "如果主人方便的话" }],
    note: "少一点米饭",
  });

  storage.setStorageSync("draftOrder", draft);
  await api.wechatLogin({ code: "dev-code", devRoleOverride: "owner" });

  const ownerList = await api.listOrders({ scope: "current" });
  const view = buildCatOrderView(draft.previewOrder);

  assert.equal(ownerList.orders.length, 0);
  assert.equal(view.isDraft, true);
  assert.equal(view.canSend, true);
  assert.equal(view.statusCopy, "点菜单先放这里，还没发给主人");
  assert.equal(view.statusDetail, "确认没问题再发送，主人现在还看不到。");
});

test("sending a draft creates an owner-visible order and clears draft storage", async () => {
  resetDevApiClient();

  const api = getDevApiClient();
  const storage = createMemoryStorage();
  const draft = createCatOrderDraft({
    mealTime: "dinner",
    mood: "tired",
    items: [{ menuItemId: "tomato-egg-rice", quantity: 1 }],
    wishItems: [],
    note: "少一点米饭",
  });
  storage.setStorageSync("draftOrder", draft);

  const sent = await sendCatOrderDraft({ api, storage });
  await api.wechatLogin({ code: "dev-code", devRoleOverride: "owner" });
  const ownerList = await api.listOrders({ scope: "current" });

  assert.equal(sent.order.status, ORDER_STATUS.SUBMITTED);
  assert.equal(storage.getStorageSync("draftOrder"), undefined);
  assert.equal(storage.getStorageSync("latestOrderId"), sent.order.id);
  assert.equal(ownerList.orders.length, 1);
  assert.equal(ownerList.orders[0].hasUnreadUpdate, true);
});

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
  assert.equal(view.hasUnreadUpdate, true);
});

test("cat read marker clears after reading owner update", async () => {
  resetDevApiClient();

  const api = getDevApiClient();
  const storage = createMemoryStorage();

  await api.wechatLogin({ code: "dev-code", devRoleOverride: "cat" });
  const created = await api.createOrder({
    mealTime: "dinner",
    mood: "tired",
    items: [{ menuItemId: "tomato-egg-rice", quantity: 1 }],
    wishItems: [],
    note: "",
  });
  storage.setStorageSync("latestOrderId", created.order.id);
  storage.setStorageSync("latestOrder", created.order);

  await api.wechatLogin({ code: "dev-code", devRoleOverride: "owner" });
  await api.acceptOrder(created.order.id);

  const unread = await loadLatestCatOrder({ api, storage });
  await api.markOrderRead(created.order.id, "cat");
  const read = await loadLatestCatOrder({ api, storage });

  assert.equal(buildCatOrderView(unread.order).hasUnreadUpdate, true);
  assert.equal(buildCatOrderView(read.order).hasUnreadUpdate, false);
});

test("cat order view exposes pending replacement confirmation copy", () => {
  const view = buildCatOrderView({
    id: "ord_0001",
    mealTime: "dinner",
    mood: "tired",
    status: ORDER_STATUS.REPLACEMENT_REQUESTED,
    items: [
      {
        id: "item_1",
        menuItemId: "tomato-egg-rice",
        name: "番茄炒蛋盖饭",
        quantity: 1,
        note: "",
      },
    ],
    wishItems: [],
    note: "",
    unreadByRoles: {
      cat: true,
      owner: false,
    },
    replacementRequests: [
      {
        id: "rr_0001",
        status: "pending",
        replacements: [
          {
            originalItemId: "item_1",
            originalItemName: "番茄炒蛋盖饭",
            replacementMenuItemId: "beef-udon",
            replacementMenuItemName: "肥牛乌冬面",
            reason: "主人想换成热乎的乌冬，咪看一下好不好。",
          },
        ],
      },
    ],
  });

  assert.equal(view.hasPendingReplacement, true);
  assert.equal(view.pendingReplacementRequest.id, "rr_0001");
  assert.equal(view.pendingReplacementRequest.title, "主人想换一道");
  assert.equal(view.pendingReplacementRequest.itemsText, "番茄炒蛋盖饭 → 肥牛乌冬面");
  assert.equal(view.canConfirmReplacement, true);
});

test("cat order view shows confirmed replacement as waiting for owner", () => {
  const view = buildCatOrderView({
    id: "ord_0001",
    mealTime: "dinner",
    mood: "tired",
    status: ORDER_STATUS.REPLACEMENT_REQUESTED,
    items: [
      {
        id: "item_2",
        menuItemId: "beef-udon",
        name: "肥牛乌冬面",
        quantity: 1,
        note: "",
        replacementForItemId: "item_1",
      },
    ],
    wishItems: [],
    note: "",
    unreadByRoles: {
      cat: false,
      owner: true,
    },
    replacementRequests: [
      {
        id: "rr_0001",
        status: "confirmed",
        replacements: [],
      },
    ],
  });

  assert.equal(view.hasPendingReplacement, false);
  assert.equal(view.statusTitle, "咪同意换啦，等主人接单");
  assert.equal(view.statusDetail, "主人收到后就会继续安排。");
});

test("cat order view exposes cancel action for active sent orders only", () => {
  const baseSentOrder = {
    id: "ord_0001",
    mealTime: "dinner",
    mood: "tired",
    items: [
      {
        id: "item_1",
        menuItemId: "tomato-egg-rice",
        name: "番茄炒蛋盖饭",
        quantity: 1,
        note: "",
      },
    ],
    wishItems: [],
    note: "",
    unreadByRoles: {
      cat: false,
      owner: true,
    },
  };

  for (const status of [
    ORDER_STATUS.SUBMITTED,
    ORDER_STATUS.REPLACEMENT_REQUESTED,
    ORDER_STATUS.ACCEPTED,
    ORDER_STATUS.COOKING,
  ]) {
    const active = buildCatOrderView({
      ...baseSentOrder,
      status,
    });
    assert.equal(active.canCancel, true);
    assert.equal(active.cancelLabel, "咪不吃了");
  }

  const completed = buildCatOrderView({
    ...baseSentOrder,
    status: ORDER_STATUS.COMPLETED,
  });
  assert.equal(completed.canCancel, false);
  assert.equal(completed.cancelLabel, "");
});

test("cat order view hides replacement decisions after order is cancelled", () => {
  const view = buildCatOrderView({
    id: "ord_0001",
    mealTime: "dinner",
    mood: "tired",
    status: ORDER_STATUS.CANCELLED,
    items: [
      {
        id: "item_1",
        menuItemId: "tomato-egg-rice",
        name: "番茄炒蛋盖饭",
        quantity: 1,
        note: "",
      },
    ],
    wishItems: [],
    note: "",
    unreadByRoles: {
      cat: true,
      owner: false,
    },
    replacementRequests: [
      {
        id: "rr_0001",
        status: "pending",
        replacements: [
          {
            originalItemId: "item_1",
            originalItemName: "番茄炒蛋盖饭",
            replacementMenuItemId: "beef-udon",
            replacementMenuItemName: "肥牛乌冬面",
            reason: "主人想换一道。",
          },
        ],
      },
    ],
  });

  assert.equal(view.canCancel, false);
  assert.equal(view.hasPendingReplacement, false);
  assert.equal(view.canConfirmReplacement, false);
  assert.equal(view.pendingReplacementRequest, null);
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
    removeStorageSync(key) {
      state.delete(key);
    },
  };
}
