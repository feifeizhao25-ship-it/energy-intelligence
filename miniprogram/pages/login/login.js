const { request } = require('../../utils/api');

Page({
  data: { phone: '', code: '', consent: false, message: '' },
  onPhone(event) { this.setData({ phone: event.detail.value }); },
  onCode(event) { this.setData({ code: event.detail.value }); },
  onConsent(event) { this.setData({ consent: !!event.detail.value.length }); },
  async send() {
    if (!this.data.consent) {
      this.setData({ message: '请先同意接收验证码' });
      return;
    }
    try {
      await request('/api/v1/auth/sms/send', 'POST', { phone: this.data.phone, consent: true });
      this.setData({ message: '如果通道已配置，验证码会发到手机。' });
    } catch (error) {
      this.setData({ message: error.message || '验证码发送失败' });
    }
  },
  async login() {
    if (!this.data.consent) {
      this.setData({ message: '请先同意接收验证码' });
      return;
    }
    try {
      const body = await request('/api/v1/auth/sms/login', 'POST', {
        phone: this.data.phone,
        code: this.data.code,
        consent: true,
      });
      const token = body && body.data ? body.data.access_token : '';
      if (!token) throw new Error('登录没有返回凭证');
      const app = getApp();
      app.globalData.token = token;
      wx.setStorageSync('token', token);
      wx.navigateBack();
    } catch (error) {
      this.setData({ message: error.message || '登录失败' });
    }
  },
});
