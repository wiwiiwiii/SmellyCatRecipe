const { ROLE } = require("./constants");

const DEFAULT_DEV_CODE = "dev-code";

function resolveApiMode({ api, apiBaseUrl = "" } = {}) {
  if (api && typeof api.isBackendApi === "boolean") {
    return { isBackendApi: api.isBackendApi };
  }
  return { apiBaseUrl };
}

function buildRoleLoginInput(role, { apiBaseUrl = "", isBackendApi = Boolean(apiBaseUrl) } = {}) {
  if (isBackendApi) return {};
  return {
    code: DEFAULT_DEV_CODE,
    devRoleOverride: role,
  };
}

function buildCurrentLoginInput({ apiBaseUrl = "", isBackendApi = Boolean(apiBaseUrl) } = {}) {
  if (isBackendApi) return {};
  return buildRoleLoginInput(ROLE.CAT, { apiBaseUrl, isBackendApi });
}

async function loginCurrentUser({ api, apiBaseUrl = "" } = {}) {
  const response = await api.wechatLogin(buildCurrentLoginInput(resolveApiMode({ api, apiBaseUrl })));
  return response.user;
}

async function loginAsRole({ api, role, apiBaseUrl = "" } = {}) {
  const response = await api.wechatLogin(buildRoleLoginInput(role, resolveApiMode({ api, apiBaseUrl })));
  const user = response.user;
  if (!user || user.role !== role) {
    throw new Error(getRoleMismatchMessage(role));
  }
  return user;
}

function getLaunchRouteForRole(role) {
  return role === ROLE.OWNER ? "/pages/owner/owner" : "/pages/menu/menu";
}

function getRoleMismatchMessage(role) {
  return role === ROLE.OWNER ? "当前微信不是主人" : "当前微信不是咪";
}

module.exports = {
  buildCurrentLoginInput,
  buildRoleLoginInput,
  getLaunchRouteForRole,
  loginAsRole,
  loginCurrentUser,
  resolveApiMode,
};
