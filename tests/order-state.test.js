const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ORDER_STATUS,
  ROLE,
} = require("../services/constants");
const {
  assertTransition,
  buildOrderEvent,
  getNextOrderStatus,
  getStatusCopy,
} = require("../services/order-state");

test("owner can move submitted order to accepted", () => {
  const next = getNextOrderStatus({
    currentStatus: ORDER_STATUS.SUBMITTED,
    action: "accept",
    actorRole: ROLE.OWNER,
    hasPendingReplacement: false,
  });

  assert.equal(next, ORDER_STATUS.ACCEPTED);
});

test("owner cannot accept an order while replacement is waiting for cat confirmation", () => {
  assert.throws(
    () =>
      getNextOrderStatus({
        currentStatus: ORDER_STATUS.REPLACEMENT_REQUESTED,
        action: "accept",
        actorRole: ROLE.OWNER,
        hasPendingReplacement: true,
      }),
    /替换还没有得到咪确认/
  );
});

test("cat confirmation keeps replacement order ready for owner acceptance", () => {
  const next = getNextOrderStatus({
    currentStatus: ORDER_STATUS.REPLACEMENT_REQUESTED,
    action: "confirm_replacement",
    actorRole: ROLE.CAT,
    hasPendingReplacement: true,
  });

  assert.equal(next, ORDER_STATUS.REPLACEMENT_REQUESTED);
});

test("owner can complete the normal cooking flow", () => {
  assert.equal(
    getNextOrderStatus({
      currentStatus: ORDER_STATUS.ACCEPTED,
      action: "start_cooking",
      actorRole: ROLE.OWNER,
    }),
    ORDER_STATUS.COOKING
  );
  assert.equal(
    getNextOrderStatus({
      currentStatus: ORDER_STATUS.COOKING,
      action: "complete",
      actorRole: ROLE.OWNER,
    }),
    ORDER_STATUS.COMPLETED
  );
});

test("cat cannot perform owner-only cooking actions", () => {
  assert.throws(
    () =>
      assertTransition({
        currentStatus: ORDER_STATUS.ACCEPTED,
        action: "start_cooking",
        actorRole: ROLE.CAT,
      }),
    /只有主人可以/
  );
});

test("status copy uses natural app language", () => {
  assert.equal(getStatusCopy(ORDER_STATUS.ACCEPTED, ROLE.CAT), "主人收到啦，咪等一下");
  assert.equal(getStatusCopy(ORDER_STATUS.COOKING, ROLE.OWNER), "正在做，别让咪等太久");
});

test("order events include actor role and ISO timestamp", () => {
  const event = buildOrderEvent({
    type: "accepted",
    actorRole: ROLE.OWNER,
    note: "主人收到啦",
    now: new Date("2026-08-02T10:20:30.000Z"),
  });

  assert.equal(event.type, "accepted");
  assert.equal(event.actorRole, ROLE.OWNER);
  assert.equal(event.createdAt, "2026-08-02T10:20:30.000Z");
});
