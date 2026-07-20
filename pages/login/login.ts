import { api } from '../utils/api';
import { setToken, setUserInfo } from '../utils/auth';

Page({
  data: {
    loading: false,
    authError: '',
    userId: '',
    phoneLoading: false,
  },

  onLoad() {
    // 页面加载后立即开始静默授权
    this.startAuth();
  },

  async startAuth() {
    this.setData({ loading: true, authError: '' });

    try {
      // 第一步：获取 authCode（静默，不弹窗）
      const authResult = await new Promise<any>((resolve, reject) => {
        my.getAuthCode({
          scopes: 'auth_base',
          success: (res: any) => resolve(res),
          fail: (err: any) => reject(err),
        });
      });

      const authCode = authResult.authCode;
      if (!authCode) {
        throw new Error('获取授权码失败');
      }

      // 第二步：发送 authCode 到后端换取 userId
      const { userId } = await api.authCodeLogin(authCode);
      if (!userId) {
        throw new Error('获取用户信息失败');
      }

      this.setData({ userId, loading: false });
    } catch (err: any) {
      console.error('Auth failed:', err);
      this.setData({
        loading: false,
        authError: err.errorMessage || err.message || '授权失败，请重试',
      });
    }
  },

  // 第三步：用户点击按钮授权手机号（getAuthorize 方式）
  getPhoneNumber() {
    if (this.data.phoneLoading) return;

    my.getPhoneNumber({
      success: (res) => {
        // res.response 是 JSON 字符串，包含 response(加密数据) 和 sign(签名)
        let encryptedData = res.response;
        try {
          const parsed = JSON.parse(encryptedData);
          encryptedData = parsed.response;
        } catch (e) {
          // 已经是纯加密字符串，直接使用
        }

        if (!encryptedData) {
          my.showToast({ content: '获取手机号失败', type: 'none' });
          return;
        }

        this.setData({ phoneLoading: true });

        api.phoneLogin(this.data.userId, encryptedData)
          .then((result) => {
            if (result.token) {
              setToken(result.token);
              if (result.userInfo) {
                setUserInfo(result.userInfo);
              }
              my.showToast({ content: '登录成功' });
              setTimeout(() => {
                my.navigateBack({
                  fail: () => {
                    // 无历史栈时兜底回首页
                    my.reLaunch({ url: '/pages/index/index' });
                  },
                });
              }, 500);
            } else {
              throw new Error('登录失败，请重试');
            }
          })
          .catch((err: any) => {
            console.error('Phone login failed:', err);
            my.showToast({
              content: err.errorMessage || err.message || '登录失败，请重试',
              type: 'none',
            });
            this.setData({ phoneLoading: false });
          });
      },
      fail: (res) => {
        console.error('getPhoneNumber fail:', res);
        my.showToast({ content: '获取手机号失败', type: 'none' });
      },
    });
  },

  handleAuthError(e: any) {
    console.error('Auth error:', e.detail);
    my.showToast({ content: e.detail?.errorMessage || '授权失败', type: 'none' });
  },

  onRetry() {
    this.setData({ authError: '', userId: '' });
    this.startAuth();
  },
});
