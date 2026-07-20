import { isLogin, getToken, clearToken, getUserInfo } from '../../utils/auth';

Page({
  data: {
    isLogin: false,
    userInfo: null as any,
  },

  onShow() {
    this.loadUserInfo();
  },

  loadUserInfo() {
    const loggedIn = isLogin();
    const cached = getUserInfo();

    this.setData({
      isLogin: loggedIn,
      userInfo: cached || null,
    });

    // 如果已登录，尝试刷新用户信息
    if (loggedIn) {
      this.refreshUserProfile();
    }
  },

  async refreshUserProfile() {
    try {
      const { api } = require('../../utils/api');
      const user = await api.getUserProfile();
      if (user) {
        this.setData({ userInfo: user });
        const { setUserInfo } = require('../../utils/auth');
        setUserInfo(user);
      }
    } catch (err) {
      // 后端接口暂未就绪，使用缓存兜底
      console.error('Failed to load user profile:', err);
    }
  },

  onAvatarTap() {
    // 未登录 -> 跳转登录页
    // 已登录 -> 不做操作（显示默认信息即可）
    if (!this.data.isLogin) {
      my.navigateTo({ url: '/pages/login/login' });
    }
  },

  onMyClues() {
    if (!this.data.isLogin) {
      my.showToast({ content: '请先登录', type: 'none' });
      return;
    }
    my.navigateTo({ url: '/pages/clue/list/list' });
  },

  onGoHome() {
    my.reLaunch({ url: '/pages/index/index' });
  },

  onLogout() {
    my.confirm({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res: any) => {
        if (res.confirm) {
          clearToken();
          this.setData({
            isLogin: false,
            userInfo: null,
          });
          my.showToast({ content: '已退出' });
        }
      },
    });
  },
});
