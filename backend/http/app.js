const http = require("node:http");
const { createDevAuthService } = require("../auth/dev-auth-service");
const { createHttpError } = require("../auth/dev-auth-service");

function createApp({
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

      if (method === "GET" && url.pathname === "/v1/menu-items") {
        const filters = {
          includeHidden: url.searchParams.get("includeHidden") === "true",
          mealTime: url.searchParams.get("mealTime") || "",
          mood: url.searchParams.get("mood") || "",
          q: url.searchParams.get("q") || "",
        };
        return json(200, await menuItemsRepository.list(filters));
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

module.exports = {
  createApp,
  createNodeHandler,
  listen,
};
