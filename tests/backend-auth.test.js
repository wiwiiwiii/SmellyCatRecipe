const test = require("node:test");
const assert = require("node:assert/strict");

const { createTokenService } = require("../backend/auth/token-service");
const { createWechatAuthService } = require("../backend/auth/wechat-auth-service");

test("token service signs and verifies app users", () => {
  const tokenService = createTokenService({ secret: "test-secret" });
  const token = tokenService.signUser({
    id: "usr_cat",
    role: "cat",
    displayName: "咪",
    openidBound: true,
  });

  assert.match(token, /^app-token\./);
  assert.deepEqual(tokenService.verifyToken(token), {
    id: "usr_cat",
    role: "cat",
    displayName: "咪",
    openidBound: true,
  });
});

test("token service returns null for malformed signatures without throwing", () => {
  const tokenService = createTokenService({ secret: "test-secret" });
  const token = tokenService.signUser({
    id: "usr_cat",
    role: "cat",
    displayName: "咪",
    openidBound: true,
  });
  const [prefix, payload] = token.split(".");

  assert.equal(tokenService.verifyToken(`${prefix}.${payload}.short`), null);
});

test("wechat auth service maps openid to configured role and upserts user", async () => {
  const upserts = [];
  const authService = createWechatAuthService({
    env: {
      WECHAT_APP_ID: "wx-app-id",
      WECHAT_APP_SECRET: "wx-secret",
      WECHAT_CAT_OPENIDS: "cat-openid",
      WECHAT_OWNER_OPENIDS: "owner-openid",
      TOKEN_SECRET: "test-secret",
      NODE_ENV: "production",
    },
    fetchJson: async (url) => {
      assert.equal(url.searchParams.get("appid"), "wx-app-id");
      assert.equal(url.searchParams.get("secret"), "wx-secret");
      assert.equal(url.searchParams.get("js_code"), "login-code");
      return {
        openid: "owner-openid",
        session_key: "session-key",
      };
    },
    userRepository: {
      async upsertWechatUser(user) {
        upserts.push(user);
        return user;
      },
    },
  });

  const response = await authService.wechatLogin({ code: "login-code" });

  assert.equal(response.user.role, "owner");
  assert.equal(response.user.displayName, "主人");
  assert.equal(upserts[0].openid, "owner-openid");
  assert.match(response.token, /^app-token\./);
});

test("wechat auth service rejects unbound openid in production", async () => {
  const authService = createWechatAuthService({
    env: {
      WECHAT_APP_ID: "wx-app-id",
      WECHAT_APP_SECRET: "wx-secret",
      WECHAT_CAT_OPENIDS: "cat-openid",
      WECHAT_OWNER_OPENIDS: "owner-openid",
      TOKEN_SECRET: "test-secret",
      NODE_ENV: "production",
    },
    fetchJson: async () => ({
      openid: "stranger-openid",
      session_key: "session-key",
    }),
    userRepository: {
      async upsertWechatUser(user) {
        return user;
      },
    },
  });

  await assert.rejects(
    () => authService.wechatLogin({ code: "login-code" }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, "WECHAT_OPENID_NOT_ALLOWED");
      return true;
    },
  );
});
