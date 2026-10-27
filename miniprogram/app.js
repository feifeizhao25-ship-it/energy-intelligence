App({
  globalData: {
    apiBase: '',
    token: '',
  },
  onLaunch() {
    try {
      const stored = wx.getStorageSync('apiBase');
      if (stored) this.globalData.apiBase = stored;
      this.globalData.token = wx.getStorageSync('token') || '';
    } catch (error) {
      this.globalData.apiBase = '';
    }
  },
});
