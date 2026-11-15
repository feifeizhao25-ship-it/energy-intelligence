function request(path, method, data) {
  const app = getApp();
  const base = (app.globalData.apiBase || '').replace(/\/$/, '');
  if (!base) {
    return Promise.reject(new Error('未配置接口'));
  }
  return new Promise((resolve, reject) => {
    wx.request({
      url: base + path,
      method,
      data,
      header: {
        'content-type': 'application/json',
        Authorization: app.globalData.token ? `Bearer ${app.globalData.token}` : '',
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data);
        else reject(new Error((res.data && (res.data.detail || res.data.message)) || '请求失败'));
      },
      fail() {
        reject(new Error('网络不可用'));
      },
    });
  });
}

module.exports = { request };
