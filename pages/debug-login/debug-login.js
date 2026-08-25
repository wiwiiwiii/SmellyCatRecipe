Page({
  data: {
    code: "",
    error: "",
    status: "正在向微信要登录码...",
  },

  onLoad() {
    this.getLoginCode();
  },

  getLoginCode() {
    this.setData({
      code: "",
      error: "",
      status: "正在向微信要登录码...",
    });

    wx.login({
      success: (response) => {
        const code = response && response.code;
        if (!code) {
          this.setData({
            error: JSON.stringify(response || { message: "NO_CODE" }),
            status: "微信没有返回 code",
          });
          return;
        }

        this.setData({
          code,
          status: "登录码已复制，可以回终端换 openid",
        });
        wx.setClipboardData({
          data: code,
          success: () => {
            wx.showModal({
              title: "wx.login code",
              content: code,
              showCancel: false,
            });
          },
        });
      },
      fail: (error) => {
        this.setData({
          error: JSON.stringify(error || { message: "wx.login fail" }),
          status: "wx.login 调用失败",
        });
      },
    });
  },

  copyCode() {
    if (!this.data.code) return;
    wx.setClipboardData({
      data: this.data.code,
    });
  },
});
