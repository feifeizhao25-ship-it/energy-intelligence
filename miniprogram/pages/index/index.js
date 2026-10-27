Page({
  data: { notice: '请先配置接口地址并登录。' },
  onShow() {
    const app = getApp();
    this.setData({
      notice: app.globalData.apiBase ? '接口已填写。登录后才能查看项目。' : '未配置接口',
    });
  },
});
