const test = require("node:test");
const assert = require("node:assert/strict");

const { createWechatSubscribeService } = require("../backend/notifications/wechat-subscribe-service");

test("wechat subscribe service sends configured template with access token", async () => {
  const calls = [];
  const service = createWechatSubscribeService({
    env: {
      WECHAT_APP_ID: "wx-app-id",
      WECHAT_APP_SECRET: "wx-secret",
      WECHAT_MINIPROGRAM_STATE: "trial",
      WECHAT_TEMPLATE_OWNER_NEW_ORDER: "tmpl-owner-new-order",
    },
    fetchJson: async (url, options = {}) => {
      calls.push({ options, url: url.toString() });
      if (url.toString().includes("/cgi-bin/token")) {
        return { access_token: "access-token", expires_in: 7200 };
      }
      return { errcode: 0, errmsg: "ok" };
    },
  });

  const result = await service.send({
    data: { thing1: { value: "咪点饭啦" } },
    page: "pages/owner/owner?orderId=ord_1",
    templateKey: "owner_new_order",
    touser: "owner-openid",
  });

  assert.deepEqual(result, { status: "sent" });
  assert.match(calls[0].url, /\/cgi-bin\/token/);
  assert.equal(calls[0].url.includes("appid=wx-app-id"), true);
  assert.match(calls[1].url, /\/message\/subscribe\/send\?access_token=access-token/);
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    data: { thing1: { value: "咪点饭啦" } },
    lang: "zh_CN",
    miniprogram_state: "trial",
    page: "pages/owner/owner?orderId=ord_1",
    template_id: "tmpl-owner-new-order",
    touser: "owner-openid",
  });
});

test("wechat subscribe service reports missing template without requesting token", async () => {
  let callCount = 0;
  const service = createWechatSubscribeService({
    env: {
      WECHAT_APP_ID: "wx-app-id",
      WECHAT_APP_SECRET: "wx-secret",
    },
    fetchJson: async () => {
      callCount += 1;
      return {};
    },
  });

  const result = await service.send({
    data: {},
    templateKey: "owner_new_order",
    touser: "owner-openid",
  });

  assert.equal(callCount, 0);
  assert.deepEqual(result, {
    errorCode: "TEMPLATE_NOT_CONFIGURED",
    errorMessage: "订阅消息模板未配置",
    status: "failed",
  });
});
