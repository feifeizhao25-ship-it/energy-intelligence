      // Auth
      mockHttp.whenPost(r'auth/register', mockLoginResponse);
      mockHttp.whenPost(r'auth/login', mockLoginResponse);
      mockHttp.whenPost(r'login/phone', mockLoginResponse);
      mockHttp.whenGet(r'users/me', mockMeResponse);
