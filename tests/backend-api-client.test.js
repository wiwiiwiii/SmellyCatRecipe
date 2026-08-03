const test = require("node:test");
const assert = require("node:assert/strict");

const { createBackendApiClient } = require("../services/backend-api-client");

test("backend api client stores token and sends bearer auth on later calls", async () => {
  const calls = [];
  const api = createBackendApiClient({
    baseUrl: "https://api.example.com/v1",
    request: async (input) => {
      calls.push(input);
      if (input.url.endsWith("/auth/wechat-login")) {
        return {
          token: "signed-token",
          user: { id: "usr_cat", role: "cat", displayName: "咪", openidBound: true },
        };
      }
      return {
        items: [],
        nextCursor: null,
      };
    },
  });

  await api.wechatLogin({ code: "login-code" });
  await api.listMenuItems({ mealTime: "dinner", q: "番茄" });

  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].url, "https://api.example.com/v1/auth/wechat-login");
  assert.equal(calls[1].method, "GET");
  assert.equal(calls[1].url, "https://api.example.com/v1/menu-items?mealTime=dinner&q=%E7%95%AA%E8%8C%84");
  assert.equal(calls[1].headers.Authorization, "Bearer signed-token");
});

test("backend api client resolves wx.login code before backend login", async () => {
  const calls = [];
  global.wx = {
    login({ success }) {
      success({ code: "wx-real-code" });
    },
  };

  try {
    const api = createBackendApiClient({
      baseUrl: "https://api.example.com/v1",
      request: async (input) => {
        calls.push(input);
        return {
          token: "signed-token",
          user: { id: "usr_owner", role: "owner", displayName: "主人", openidBound: true },
        };
      },
    });

    await api.wechatLogin({ code: "dev-code", devRoleOverride: "owner" });

    assert.equal(calls[0].body.code, "wx-real-code");
    assert.equal(calls[0].body.devRoleOverride, "owner");
  } finally {
    delete global.wx;
  }
});

test("backend api client maps order and owner action endpoints", async () => {
  const calls = [];
  const api = createBackendApiClient({
    baseUrl: "https://api.example.com/v1/",
    request: async (input) => {
      calls.push(input);
      return {
        order: { id: "ord_0001" },
      };
    },
  });

  await api.createOrder({ mealTime: "dinner", mood: "tired", items: [], wishItems: [] });
  await api.getOrder("ord_0001");
  await api.acceptOrder("ord_0001");
  await api.startCooking("ord_0001");
  await api.completeOrder("ord_0001");
  await api.cancelOrder("ord_0001", { note: "不吃了" });

  assert.deepEqual(
    calls.map((call) => `${call.method} ${call.url}`),
    [
      "POST https://api.example.com/v1/orders",
      "GET https://api.example.com/v1/orders/ord_0001",
      "POST https://api.example.com/v1/orders/ord_0001/accept",
      "POST https://api.example.com/v1/orders/ord_0001/start-cooking",
      "POST https://api.example.com/v1/orders/ord_0001/complete",
      "POST https://api.example.com/v1/orders/ord_0001/cancel",
    ],
  );
});
