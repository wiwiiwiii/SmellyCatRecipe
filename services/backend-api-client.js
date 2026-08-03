function createBackendApiClient({ baseUrl, request = wxRequest } = {}) {
  if (!baseUrl) {
    throw new Error("API_BASE_URL is required");
  }
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  let token = "";

  async function call(method, path, { body, query } = {}) {
    const url = buildUrl(normalizedBaseUrl, path, query);
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return request({
      body,
      data: body,
      headers,
      method,
      url,
    });
  }

  return {
    async wechatLogin(input) {
      const response = await call("POST", "/auth/wechat-login", { body: await resolveWechatLoginInput(input) });
      token = response.token || "";
      return response;
    },
    listMenuItems(input = {}) {
      return call("GET", "/menu-items", { query: input });
    },
    createMenuItem(input) {
      return call("POST", "/menu-items", { body: input });
    },
    updateMenuItem(menuItemId, patch) {
      return call("PATCH", `/menu-items/${encodeURIComponent(menuItemId)}`, { body: patch });
    },
    createOrder(input) {
      return call("POST", "/orders", { body: input });
    },
    listOrders(input = {}) {
      return call("GET", "/orders", { query: input });
    },
    getOrder(orderId) {
      return call("GET", `/orders/${encodeURIComponent(orderId)}`);
    },
    markOrderRead(orderId) {
      return call("POST", `/orders/${encodeURIComponent(orderId)}/read`);
    },
    createRepeatDraft(orderId) {
      return call("POST", `/orders/${encodeURIComponent(orderId)}/repeat-draft`);
    },
    acceptOrder(orderId) {
      return call("POST", `/orders/${encodeURIComponent(orderId)}/accept`);
    },
    startCooking(orderId) {
      return call("POST", `/orders/${encodeURIComponent(orderId)}/start-cooking`);
    },
    completeOrder(orderId) {
      return call("POST", `/orders/${encodeURIComponent(orderId)}/complete`);
    },
    cancelOrder(orderId, input = {}) {
      return call("POST", `/orders/${encodeURIComponent(orderId)}/cancel`, { body: input });
    },
    requestReplacement(orderId, input) {
      return call("POST", `/orders/${encodeURIComponent(orderId)}/replacement-requests`, { body: input });
    },
    confirmReplacement(orderId, replacementRequestId, input = {}) {
      return call(
        "POST",
        `/orders/${encodeURIComponent(orderId)}/replacement-requests/${encodeURIComponent(replacementRequestId)}/confirm`,
        { body: input },
      );
    },
    rejectReplacement(orderId, replacementRequestId, input = {}) {
      return call(
        "POST",
        `/orders/${encodeURIComponent(orderId)}/replacement-requests/${encodeURIComponent(replacementRequestId)}/reject`,
        { body: input },
      );
    },
    recordNotificationSubscriptions(input) {
      return call("POST", "/notification-subscriptions", { body: input });
    },
    listNotificationLogs(input = {}) {
      return call("GET", "/notification-logs", { query: input });
    },
  };
}

function buildUrl(baseUrl, path, query = {}) {
  const url = new URL(`${baseUrl}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function resolveWechatLoginInput(input = {}) {
  const shouldUseWxLogin = !input.code || input.code === "dev-code";
  if (!shouldUseWxLogin || !hasWxLogin()) return input;
  return {
    ...input,
    code: await wxLogin(),
  };
}

function hasWxLogin() {
  return typeof wx !== "undefined" && wx && typeof wx.login === "function";
}

function wxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(response) {
        if (response && response.code) {
          resolve(response.code);
          return;
        }
        reject(new Error("微信登录没有返回 code"));
      },
      fail(error) {
        reject(new Error(error.errMsg || "微信登录失败"));
      },
    });
  });
}

function wxRequest(input) {
  return new Promise((resolve, reject) => {
    wx.request({
      data: input.body,
      header: input.headers,
      method: input.method,
      url: input.url,
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data);
          return;
        }
        const message = response.data && response.data.error ? response.data.error.message : "请求失败";
        reject(new Error(message));
      },
      fail(error) {
        reject(new Error(error.errMsg || "网络请求失败"));
      },
    });
  });
}

module.exports = {
  buildUrl,
  createBackendApiClient,
  resolveWechatLoginInput,
};
