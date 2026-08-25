const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildCode2SessionUrl,
  exchangeCodeForOpenid,
  formatOpenidOutput,
  parseLocalEnvContent,
} = require("../scripts/wechat-openid");

test("wechat openid helper builds the official code2Session URL", () => {
  const url = buildCode2SessionUrl({
    appId: "wx-test-app-id",
    appSecret: "test-secret",
    code: "test-code",
  });

  assert.equal(url.origin + url.pathname, "https://api.weixin.qq.com/sns/jscode2session");
  assert.equal(url.searchParams.get("appid"), "wx-test-app-id");
  assert.equal(url.searchParams.get("secret"), "test-secret");
  assert.equal(url.searchParams.get("js_code"), "test-code");
  assert.equal(url.searchParams.get("grant_type"), "authorization_code");
});

test("wechat openid helper exchanges a login code and only formats the openid", async () => {
  const calls = [];
  const openid = await exchangeCodeForOpenid({
    code: "test-code",
    env: {
      WECHAT_APP_ID: "wx-test-app-id",
      WECHAT_APP_SECRET: "test-secret",
    },
    fetchImpl: async (url) => {
      calls.push(String(url));
      return {
        ok: true,
        json: async () => ({ openid: "openid-cat" }),
      };
    },
  });

  assert.equal(openid, "openid-cat");
  assert.equal(formatOpenidOutput(openid), "openid-cat\n");
  assert.match(calls[0], /secret=test-secret/);
  assert.doesNotMatch(formatOpenidOutput(openid), /test-secret/);
});

test("wechat openid helper can read secrets from local compose override content", async () => {
  const localEnv = parseLocalEnvContent(`
services:
  api:
    environment:
      WECHAT_APP_ID: wx-local-app-id
      WECHAT_APP_SECRET: local-secret
      WECHAT_ALLOW_UNKNOWN_CAT: "false"
`);

  const openid = await exchangeCodeForOpenid({
    code: "test-code",
    env: {},
    localEnv,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ openid: "openid-owner" }),
    }),
  });

  assert.equal(localEnv.WECHAT_APP_ID, "wx-local-app-id");
  assert.equal(localEnv.WECHAT_APP_SECRET, "local-secret");
  assert.equal(openid, "openid-owner");
});

test("wechat openid helper reports placeholder secrets clearly", async () => {
  await assert.rejects(
    exchangeCodeForOpenid({
      code: "test-code",
      env: {},
      localEnv: {
        WECHAT_APP_ID: "wx-local-app-id",
        WECHAT_APP_SECRET: "replace-with-your-wechat-app-secret",
      },
      fetchImpl: async () => {
        throw new Error("fetch should not run");
      },
    }),
    /WECHAT_APP_SECRET.*placeholder/,
  );
});

test("wechat openid helper reports missing local secrets before calling WeChat", async () => {
  await assert.rejects(
    exchangeCodeForOpenid({
      code: "test-code",
      env: { WECHAT_APP_ID: "wx-test-app-id" },
      fetchImpl: async () => {
        throw new Error("fetch should not run");
      },
    }),
    /WECHAT_APP_SECRET/,
  );
});

test("wechat openid helper surfaces WeChat API errors", async () => {
  await assert.rejects(
    exchangeCodeForOpenid({
      code: "expired-code",
      env: {
        WECHAT_APP_ID: "wx-test-app-id",
        WECHAT_APP_SECRET: "test-secret",
      },
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ errcode: 40029, errmsg: "invalid code" }),
      }),
    }),
    /40029.*invalid code/,
  );
});
