const test = require("node:test");
const assert = require("node:assert/strict");

const { sendOrderNotification } = require("../backend/notifications/order-notifications");

test("order notification sends subscribed owner message and records sent log", async () => {
  const pool = createNotificationPool({ subscriptionStatus: "accept" });
  const sends = [];

  await sendOrderNotification({
    notificationService: {
      async send(input) {
        sends.push(input);
        return { status: "sent" };
      },
    },
    orderId: "ord_1",
    pool,
    sourceAction: "cat_submit_order",
  });

  assert.equal(sends.length, 1);
  assert.equal(sends[0].templateKey, "owner_new_order");
  assert.equal(sends[0].touser, "owner-openid");
  assert.equal(sends[0].page, "pages/owner/owner?orderId=ord_1");
  assert.deepEqual(sends[0].data.thing1, { value: "咪点了晚饭" });
  assert.deepEqual(sends[0].data.thing2, { value: "番茄炒蛋盖饭" });

  const logCall = pool.calls.find((call) => /insert into notification_logs/i.test(call.sql));
  assert.equal(logCall.params[2], "owner_new_order");
  assert.equal(logCall.params[3], "usr_owner");
  assert.equal(logCall.params[4], "sent");
});

test("order notification skips send when subscription was not accepted", async () => {
  const pool = createNotificationPool({ subscriptionStatus: "reject" });
  let sendCount = 0;

  await sendOrderNotification({
    notificationService: {
      async send() {
        sendCount += 1;
        return { status: "sent" };
      },
    },
    orderId: "ord_1",
    pool,
    sourceAction: "cat_submit_order",
  });

  assert.equal(sendCount, 0);
  const logCall = pool.calls.find((call) => /insert into notification_logs/i.test(call.sql));
  assert.equal(logCall.params[4], "skipped_not_authorized");
  assert.equal(logCall.params[5], "SUBSCRIPTION_NOT_AUTHORIZED");
});

function createNotificationPool({ subscriptionStatus }) {
  return {
    calls: [],
    async query(sql, params = []) {
      this.calls.push({ params, sql });

      if (/from orders/i.test(sql)) {
        return {
          rows: [
            {
              cat_openid: "cat-openid",
              cat_user_id: "usr_cat",
              id: "ord_1",
              meal_time: "dinner",
              owner_openid: "owner-openid",
              owner_user_id: "usr_owner",
              status: "submitted",
              updated_at: new Date("2026-08-03T12:00:00.000Z"),
            },
          ],
        };
      }

      if (/from order_items/i.test(sql)) {
        return { rows: [{ name: "番茄炒蛋盖饭" }] };
      }

      if (/from notification_subscriptions/i.test(sql)) {
        return { rows: subscriptionStatus ? [{ status: subscriptionStatus }] : [] };
      }

      return { rows: [] };
    },
  };
}
