const TEMPLATE_ENV_BY_KEY = {
  cat_order_accepted: "WECHAT_TEMPLATE_CAT_ORDER_ACCEPTED",
  cat_order_completed: "WECHAT_TEMPLATE_CAT_ORDER_COMPLETED",
  cat_order_cooking: "WECHAT_TEMPLATE_CAT_ORDER_COOKING",
  cat_replacement_requested: "WECHAT_TEMPLATE_CAT_REPLACEMENT_REQUESTED",
  owner_new_order: "WECHAT_TEMPLATE_OWNER_NEW_ORDER",
};

function createWechatSubscribeService({
  env = process.env,
  fetchJson = defaultFetchJson,
  now = () => Date.now(),
} = {}) {
  let cachedAccessToken = null;

  async function getAccessToken() {
    if (cachedAccessToken && cachedAccessToken.expiresAt > now()) {
      return cachedAccessToken.value;
    }
    if (!env.WECHAT_APP_ID || !env.WECHAT_APP_SECRET) {
      return null;
    }

    const url = new URL("https://api.weixin.qq.com/cgi-bin/token");
    url.searchParams.set("grant_type", "client_credential");
    url.searchParams.set("appid", env.WECHAT_APP_ID);
    url.searchParams.set("secret", env.WECHAT_APP_SECRET);

    const response = await fetchJson(url);
    if (response.errcode || !response.access_token) {
      return null;
    }

    cachedAccessToken = {
      expiresAt: now() + Math.max(Number(response.expires_in || 7200) - 300, 60) * 1000,
      value: response.access_token,
    };
    return cachedAccessToken.value;
  }

  return {
    async send({ data = {}, page = "pages/order/order", templateKey, touser }) {
      const templateId = getTemplateId(env, templateKey);
      if (!templateId) {
        return {
          errorCode: "TEMPLATE_NOT_CONFIGURED",
          errorMessage: "订阅消息模板未配置",
          status: "failed",
        };
      }
      if (!touser) {
        return {
          errorCode: "OPENID_NOT_BOUND",
          errorMessage: "接收用户没有绑定 openid",
          status: "failed",
        };
      }

      const accessToken = await getAccessToken();
      if (!accessToken) {
        return {
          errorCode: "WECHAT_ACCESS_TOKEN_FAILED",
          errorMessage: "微信 access_token 获取失败",
          status: "failed",
        };
      }

      const url = new URL("https://api.weixin.qq.com/cgi-bin/message/subscribe/send");
      url.searchParams.set("access_token", accessToken);
      const response = await fetchJson(url, {
        body: JSON.stringify({
          data,
          lang: "zh_CN",
          miniprogram_state: env.WECHAT_MINIPROGRAM_STATE || "formal",
          page,
          template_id: templateId,
          touser,
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });

      if (response.errcode) {
        return {
          errorCode: `WECHAT_${response.errcode}`,
          errorMessage: response.errmsg || "微信订阅消息发送失败",
          status: "failed",
        };
      }

      return { status: "sent" };
    },
  };
}

function getTemplateId(env, templateKey) {
  const envName = TEMPLATE_ENV_BY_KEY[templateKey];
  return envName ? env[envName] || "" : "";
}

async function defaultFetchJson(url, options) {
  const response = await fetch(url, options);
  return response.json();
}

module.exports = {
  createWechatSubscribeService,
  getTemplateId,
};
