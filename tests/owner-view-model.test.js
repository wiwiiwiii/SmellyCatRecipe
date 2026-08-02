const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ORDER_STATUS,
  ROLE,
} = require("../services/constants");
const {
  buildOwnerOrderDetailView,
  buildOwnerOrderListView,
  resolveOwnerActiveOrderId,
} = require("../services/owner-view-model");

const baseOrder = {
  id: "ord_0001",
  mealTime: "dinner",
  mood: "tired",
  status: ORDER_STATUS.SUBMITTED,
  items: [
    {
      id: "item_1",
      name: "番茄炒蛋盖饭",
      quantity: 1,
      note: "米饭少一点",
    },
  ],
  wishItems: [
    {
      id: "wish_1",
      name: "咖喱猪排饭",
      note: "如果主人方便的话",
    },
  ],
  note: "今天想吃热一点",
  events: [
    {
      id: "evt_1",
      type: "submitted",
      actorRole: ROLE.CAT,
      note: "今天想吃热一点",
      createdAt: "2026-08-02T10:20:30.000Z",
    },
  ],
  createdAt: "2026-08-02T10:20:30.000Z",
  updatedAt: "2026-08-02T10:20:30.000Z",
};

test("owner list view summarizes current orders with warm owner copy", () => {
  const view = buildOwnerOrderListView({
    orders: [
      {
        id: baseOrder.id,
        mealTime: baseOrder.mealTime,
        mood: baseOrder.mood,
        status: baseOrder.status,
        itemNames: ["番茄炒蛋盖饭", "咖喱猪排饭"],
        createdAt: baseOrder.createdAt,
        updatedAt: baseOrder.updatedAt,
      },
    ],
  });

  assert.equal(view.hasOrders, true);
  assert.equal(view.heroTitle, "咪有 1 个小愿望");
  assert.equal(view.orders[0].mealTimeText, "晚饭");
  assert.equal(view.orders[0].statusText, "咪点好啦，等主人看一下");
  assert.equal(view.orders[0].itemsText, "番茄炒蛋盖饭、咖喱猪排饭");
});

test("owner detail view exposes the right action for submitted, accepted and cooking orders", () => {
  const submitted = buildOwnerOrderDetailView({ order: baseOrder });
  assert.deepEqual(submitted.primaryAction, {
    action: "accept",
    label: "主人收到啦",
  });

  const accepted = buildOwnerOrderDetailView({
    order: {
      ...baseOrder,
      status: ORDER_STATUS.ACCEPTED,
    },
  });
  assert.deepEqual(accepted.primaryAction, {
    action: "start_cooking",
    label: "开始做饭",
  });

  const cooking = buildOwnerOrderDetailView({
    order: {
      ...baseOrder,
      status: ORDER_STATUS.COOKING,
    },
  });
  assert.deepEqual(cooking.primaryAction, {
    action: "complete",
    label: "做好了，叫咪来吃",
  });
});

test("owner detail view keeps completed orders read-only", () => {
  const view = buildOwnerOrderDetailView({
    order: {
      ...baseOrder,
      status: ORDER_STATUS.COMPLETED,
    },
  });

  assert.equal(view.canAct, false);
  assert.equal(view.primaryAction, null);
  assert.equal(view.statusText, "已完成，叫咪来吃");
});

test("owner active order resolver drops stale completed order ids", () => {
  const activeOrderId = resolveOwnerActiveOrderId({
    orders: [],
    preferredOrderId: "ord_completed",
  });

  assert.equal(activeOrderId, "");
});

test("owner active order resolver keeps preferred id only when it is still current", () => {
  const orders = [{ id: "ord_1" }, { id: "ord_2" }];

  assert.equal(
    resolveOwnerActiveOrderId({
      orders,
      preferredOrderId: "ord_2",
    }),
    "ord_2",
  );
  assert.equal(
    resolveOwnerActiveOrderId({
      orders,
      preferredOrderId: "ord_missing",
    }),
    "ord_1",
  );
});
