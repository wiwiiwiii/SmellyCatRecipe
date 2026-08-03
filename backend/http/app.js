const http = require("node:http");
const { createDevAuthService } = require("../auth/dev-auth-service");
const { createHttpError } = require("../auth/dev-auth-service");
const { ROLE } = require("../../services/constants");

function createApp({
  apiClient = createUnavailableApiClient(),
  authService = createDevAuthService(),
  menuItemsRepository = createUnavailableMenuItemsRepository(),
} = {}) {
  async function inject(request) {
    return dispatch({
      body: request.body,
      headers: request.headers || {},
      method: request.method || "GET",
      url: request.url || "/",
    });
  }

  async function dispatch(request) {
    const method = request.method.toUpperCase();
    const url = new URL(request.url, "http://localhost");
    request.authService = authService;

    try {
      if (method === "GET" && url.pathname === "/health") {
        return json(200, {
          service: "smelly-cat-recipe-api",
          status: "ok",
        });
      }

      if (method === "POST" && url.pathname === "/v1/auth/wechat-login") {
        return json(200, await authService.wechatLogin(normalizeBody(request.body)));
      }

      if (method === "GET" && url.pathname === "/v1/auth/me") {
        const user = requireCurrentUser(request);
        return json(200, { user });
      }

      if (method === "GET" && url.pathname === "/v1/menu-items") {
        const filters = {
          includeHidden: url.searchParams.get("includeHidden") === "true",
          mealTime: url.searchParams.get("mealTime") || "",
          mood: url.searchParams.get("mood") || "",
          q: url.searchParams.get("q") || "",
        };
        if (filters.includeHidden) {
          requireRole(request, ROLE.OWNER);
        }
        return json(200, await menuItemsRepository.list(filters));
      }

      if (method === "POST" && url.pathname === "/v1/menu-items") {
        return json(201, await apiClient.createMenuItem(normalizeBody(request.body), requireRole(request, ROLE.OWNER)));
      }

      const menuItemMatch = matchPath(url.pathname, /^\/v1\/menu-items\/([^/]+)$/);
      if (method === "PATCH" && menuItemMatch) {
        return json(
          200,
          await apiClient.updateMenuItem(menuItemMatch[1], normalizeBody(request.body), requireRole(request, ROLE.OWNER)),
        );
      }

      if (method === "GET" && url.pathname === "/v1/orders") {
        return json(
          200,
          await apiClient.listOrders({
            scope: url.searchParams.get("scope") || "current",
          }, requireCurrentUser(request)),
        );
      }

      if (method === "POST" && url.pathname === "/v1/orders") {
        return json(201, await apiClient.createOrder(normalizeBody(request.body), requireRole(request, ROLE.CAT)));
      }

      const orderMatch = matchPath(url.pathname, /^\/v1\/orders\/([^/]+)$/);
      if (method === "GET" && orderMatch) {
        return json(200, await apiClient.getOrder(orderMatch[1], requireCurrentUser(request)));
      }

      const readMatch = matchPath(url.pathname, /^\/v1\/orders\/([^/]+)\/read$/);
      if (method === "POST" && readMatch) {
        return json(200, await apiClient.markOrderRead(readMatch[1], requireCurrentUser(request)));
      }

      const repeatMatch = matchPath(url.pathname, /^\/v1\/orders\/([^/]+)\/repeat-draft$/);
      if (method === "POST" && repeatMatch) {
        return json(200, await apiClient.createRepeatDraft(repeatMatch[1], requireRole(request, ROLE.CAT)));
      }

      const replacementMatch = matchPath(url.pathname, /^\/v1\/orders\/([^/]+)\/replacement-requests$/);
      if (method === "POST" && replacementMatch) {
        return json(
          201,
          await apiClient.requestReplacement(replacementMatch[1], normalizeBody(request.body), requireRole(request, ROLE.OWNER)),
        );
      }

      const confirmReplacementMatch = matchPath(
        url.pathname,
        /^\/v1\/orders\/([^/]+)\/replacement-requests\/([^/]+)\/confirm$/,
      );
      if (method === "POST" && confirmReplacementMatch) {
        return json(
          200,
          await apiClient.confirmReplacement(
            confirmReplacementMatch[1],
            confirmReplacementMatch[2],
            normalizeBody(request.body),
            requireRole(request, ROLE.CAT),
          ),
        );
      }

      const rejectReplacementMatch = matchPath(
        url.pathname,
        /^\/v1\/orders\/([^/]+)\/replacement-requests\/([^/]+)\/reject$/,
      );
      if (method === "POST" && rejectReplacementMatch) {
        return json(
          200,
          await apiClient.rejectReplacement(
            rejectReplacementMatch[1],
            rejectReplacementMatch[2],
            normalizeBody(request.body),
            requireRole(request, ROLE.CAT),
          ),
        );
      }

      for (const action of ["accept", "start-cooking", "complete", "cancel"]) {
        const actionMatch = matchPath(url.pathname, new RegExp(`^/v1/orders/([^/]+)/${action}$`));
        if (method === "POST" && actionMatch) {
          return json(200, await runOrderAction({
            action,
            apiClient,
            body: normalizeBody(request.body),
            orderId: actionMatch[1],
            request,
          }));
        }
      }

      if (method === "GET" && url.pathname === "/v1/notification-templates") {
        requireCurrentUser(request);
        return json(200, {
          templates: buildNotificationTemplates(),
        });
      }

      if (method === "POST" && url.pathname === "/v1/notification-subscriptions") {
        return json(
          200,
          await apiClient.recordNotificationSubscriptions(normalizeBody(request.body), requireCurrentUser(request)),
        );
      }

      if (method === "GET" && url.pathname === "/v1/notification-logs") {
        return json(
          200,
          await apiClient.listNotificationLogs({
            orderId: url.searchParams.get("orderId") || "",
          }, requireCurrentUser(request)),
        );
      }

      throw createHttpError(404, "NOT_FOUND", "接口不存在");
    } catch (error) {
      return json(error.statusCode || 500, {
        error: {
          code: error.code || "INTERNAL_SERVER_ERROR",
          message: error.message,
          details: error.details || {},
        },
      });
    }
  }

  return {
    dispatch,
    inject,
  };
}

function runOrderAction({ action, apiClient, body, orderId, request }) {
  if (action === "accept") return apiClient.acceptOrder(orderId, requireRole(request, ROLE.OWNER));
  if (action === "start-cooking") return apiClient.startCooking(orderId, requireRole(request, ROLE.OWNER));
  if (action === "complete") return apiClient.completeOrder(orderId, requireRole(request, ROLE.OWNER));
  if (action === "cancel") return apiClient.cancelOrder(orderId, body, requireCurrentUser(request));
  throw createHttpError(404, "NOT_FOUND", "接口不存在");
}

function createNodeHandler(app) {
  return async (req, res) => {
    const body = await readRequestBody(req);
    const response = await app.dispatch({
      body,
      headers: req.headers,
      method: req.method,
      url: req.url,
    });

    res.writeHead(response.statusCode, {
      "content-type": "application/json; charset=utf-8",
    });
    res.end(JSON.stringify(response.body));
  };
}

function listen(app, { port = 3000, host = "0.0.0.0" } = {}) {
  const server = http.createServer(createNodeHandler(app));
  return new Promise((resolve) => {
    server.listen(port, host, () => resolve(server));
  });
}

function normalizeBody(body) {
  if (!body) return {};
  if (typeof body === "string") return JSON.parse(body);
  return body;
}

function json(statusCode, body) {
  return {
    body,
    statusCode,
  };
}

function matchPath(pathname, pattern) {
  const match = pathname.match(pattern);
  if (!match) return null;
  return match.map((item) => (typeof item === "string" ? decodeURIComponent(item) : item));
}

function requireRole(request, role) {
  const user = requireCurrentUser(request);
  if (user.role !== role) {
    throw createHttpError(403, "FORBIDDEN_ROLE", "当前角色不能执行操作", {
      currentRole: user.role,
      requiredRole: role,
    });
  }
  return user;
}

function requireCurrentUser(request) {
  const user = getCurrentUser(request);
  if (!user) {
    throw createHttpError(401, "AUTH_REQUIRED", "缺少或无效登录态");
  }
  return user;
}

function getCurrentUser(request) {
  const authorization = request.headers.authorization || request.headers.Authorization || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1];
  if (request.authService && typeof request.authService.verifyToken === "function") {
    const verified = request.authService.verifyToken(token);
    if (verified) return verified;
  }
  return parseDevToken(token);
}

function parseDevToken(token) {
  const match = token.match(/^dev-token-(cat|owner)-/);
  if (!match) return null;
  const role = match[1];
  return {
    id: role === ROLE.OWNER ? "usr_owner" : "usr_cat",
    role,
    displayName: role === ROLE.OWNER ? "主人" : "咪",
    openidBound: true,
  };
}

function buildNotificationTemplates() {
  return [
    {
      templateKey: "owner_new_order",
      templateId: process.env.WECHAT_TEMPLATE_OWNER_NEW_ORDER || "",
      recipientRole: ROLE.OWNER,
      sourceAction: "cat_submit_order",
    },
    {
      templateKey: "cat_replacement_requested",
      templateId: process.env.WECHAT_TEMPLATE_CAT_REPLACEMENT_REQUESTED || "",
      recipientRole: ROLE.CAT,
      sourceAction: "owner_request_replacement",
    },
    {
      templateKey: "cat_order_accepted",
      templateId: process.env.WECHAT_TEMPLATE_CAT_ORDER_ACCEPTED || "",
      recipientRole: ROLE.CAT,
      sourceAction: "owner_accept_order",
    },
    {
      templateKey: "cat_order_cooking",
      templateId: process.env.WECHAT_TEMPLATE_CAT_ORDER_COOKING || "",
      recipientRole: ROLE.CAT,
      sourceAction: "owner_start_cooking",
    },
    {
      templateKey: "cat_order_completed",
      templateId: process.env.WECHAT_TEMPLATE_CAT_ORDER_COMPLETED || "",
      recipientRole: ROLE.CAT,
      sourceAction: "owner_complete_order",
    },
  ];
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("error", reject);
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(createHttpError(400, "INVALID_JSON", "请求 JSON 无效"));
      }
    });
  });
}

function createUnavailableMenuItemsRepository() {
  return {
    async list() {
      throw createHttpError(503, "DATABASE_NOT_CONFIGURED", "菜单数据库未配置");
    },
  };
}

function createUnavailableApiClient() {
  const unavailable = async () => {
    throw createHttpError(503, "DATABASE_NOT_CONFIGURED", "后端数据库未配置");
  };

  return {
    acceptOrder: unavailable,
    cancelOrder: unavailable,
    completeOrder: unavailable,
    confirmReplacement: unavailable,
    createMenuItem: unavailable,
    createOrder: unavailable,
    createRepeatDraft: unavailable,
    getOrder: unavailable,
    listNotificationLogs: unavailable,
    listOrders: unavailable,
    markOrderRead: unavailable,
    recordNotificationSubscriptions: unavailable,
    rejectReplacement: unavailable,
    requestReplacement: unavailable,
    startCooking: unavailable,
    updateMenuItem: unavailable,
  };
}

module.exports = {
  createApp,
  createNodeHandler,
  listen,
};
