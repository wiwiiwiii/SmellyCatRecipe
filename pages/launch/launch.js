const { getDevApiClient } = require("../../services/dev-api-client");
const {
  getLaunchRouteForRole,
  loginCurrentUser,
} = require("../../services/auth-session");

const api = getDevApiClient();

Page({
  data: {
    appEnglishName: "Puppy Cat Feeder",
    appName: "小狗咪的喂食器",
    error: "",
    status: "正在认出你是谁...",
  },

  async onLoad() {
    await this.routeByWechatIdentity();
  },

  async routeByWechatIdentity() {
    this.setData({
      error: "",
      status: "正在认出你是谁...",
    });

    try {
      const user = await loginCurrentUser({ api });
      wx.reLaunch({
        url: getLaunchRouteForRole(user.role),
      });
    } catch (error) {
      this.setData({
        error: error.message,
        status: "还没认出来",
      });
    }
  },
});
