import { getToken } from './pages/utils/auth';

App({
  globalData: {
    token: '',
    userInfo: null as any,
  },

  onLaunch() {
    console.info('App onLaunch');
    // 检查本地存储的 token
    const token = getToken();
    if (token) {
      this.globalData.token = token;
      // 恢复用户信息
      try {
        const userInfo = (my.getStorageSync({ key: 'userInfo' }).data as any);
        if (userInfo) {
          this.globalData.userInfo = userInfo;
        }
      } catch {}
    }
  },

  onShow() {
    // 同步 globalData 中的 token
    this.globalData.token = getToken();
  },
});
