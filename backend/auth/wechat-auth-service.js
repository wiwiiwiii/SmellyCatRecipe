const { ROLE } = require("../../services/constants");
const { createHttpError } = require("./dev-auth-service");
const { createTokenService } = require("./token-service");

function createWechatAuthService({
  env = process.env,
  fetchJson = defaultFetchJson,
  tokenService = createTokenService({ secret: env.TOKEN_SECRET }),
  userRepository,
} = {}) {
  return {
    async wechatLogin(input = {}) {
      if (!input.code) {
        throw createHttpError(400, "AUTH_INVALID_CODE", "微信登录 code 无效");
      }

      if (input.devRoleOverride && env.NODE_ENV !== "production") {
        const user = buildDevUser(input.devRoleOverride);
        const persisted = userRepository ? await userRepository.upsertWechatUser(user) : user;
        return {
          token: tokenService.signUser(persisted),
          user: persisted,
        };
      }

      const session = await code2Session({
        code: input.code,
        env,
        fetchJson,
      });
      const role = resolveRoleForOpenid(session.openid, env);
      const user = {
        id: role === ROLE.OWNER ? "usr_owner" : "usr_cat",
        role,
        displayName: role === ROLE.OWNER ? "主人" : "咪",
        openid: session.openid,
        openidBound: true,
      };
      const persisted = userRepository ? await userRepository.upsertWechatUser(user) : user;

      return {
        token: tokenService.signUser(persisted),
        user: persisted,
      };
    },

    verifyToken(token) {
      return tokenService.verifyToken(token);
    },
  };
}

async function code2Session({ code, env, fetchJson }) {
  if (!env.WECHAT_APP_ID || !env.WECHAT_APP_SECRET) {
    throw createHttpError(500, "WECHAT_CONFIG_MISSING", "缺少微信 AppID 或 AppSecret");
  }

  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", env.WECHAT_APP_ID);
  url.searchParams.set("secret", env.WECHAT_APP_SECRET);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");

  const response = await fetchJson(url);
  if (response.errcode) {
    throw createHttpError(502, "WECHAT_API_FAILED", response.errmsg || "微信登录失败", {
      errcode: response.errcode,
    });
  }
  if (!response.openid) {
    throw createHttpError(502, "WECHAT_API_FAILED", "微信登录没有返回 openid");
  }

  return response;
}

async function defaultFetchJson(url) {
  const response = await fetch(url);
  return response.json();
}

function resolveRoleForOpenid(openid, env) {
  if (splitOpenids(env.WECHAT_MASTER_OPENIDS || env.WECHAT_OWNER_OPENIDS).includes(openid)) return ROLE.OWNER;
  if (splitOpenids(env.WECHAT_CAT_OPENIDS).includes(openid)) return ROLE.CAT;
  if (env.WECHAT_ALLOW_UNKNOWN_CAT === "true") return ROLE.CAT;
  throw createHttpError(403, "WECHAT_OPENID_NOT_ALLOWED", "当前微信没有绑定到小狗咪的喂食器");
}

function splitOpenids(value = "") {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildDevUser(role) {
  if (![ROLE.CAT, ROLE.OWNER].includes(role)) {
    throw createHttpError(400, "INVALID_ROLE", "开发身份无效", { role });
  }
  return {
    id: role === ROLE.OWNER ? "usr_owner" : "usr_cat",
    role,
    displayName: role === ROLE.OWNER ? "主人" : "咪",
    openid: role === ROLE.OWNER ? "dev-owner-openid" : "dev-cat-openid",
    openidBound: true,
  };
}

module.exports = {
  createWechatAuthService,
  resolveRoleForOpenid,
};
