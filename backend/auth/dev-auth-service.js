const { ROLE } = require("../../services/constants");

function createDevAuthService({ now = () => new Date() } = {}) {
  return {
    async wechatLogin(input = {}) {
      if (!input.code) {
        throw createHttpError(400, "AUTH_INVALID_CODE", "微信登录 code 无效");
      }

      const role = normalizeRole(input.devRoleOverride);
      const user = {
        id: role === ROLE.OWNER ? "usr_owner" : "usr_cat",
        role,
        displayName: role === ROLE.OWNER ? "主人" : "咪",
        openidBound: true,
      };

      return {
        token: `dev-token-${role}-${now().getTime()}`,
        user,
      };
    },
  };
}

function normalizeRole(role) {
  if (!role) return ROLE.CAT;
  if ([ROLE.CAT, ROLE.OWNER].includes(role)) return role;
  throw createHttpError(400, "INVALID_ROLE", "开发身份无效", { role });
}

function createHttpError(statusCode, code, message, details = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

module.exports = {
  createDevAuthService,
  createHttpError,
};
