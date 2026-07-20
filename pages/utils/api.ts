import { get, post } from './request';

export const api = {
  // Auth
  authCodeLogin: (authCode: string) => post<{ userId: string }>('/auth/code-login', { authCode }),
  phoneLogin: (userId: string, response: string) => post<{ token: string; userInfo: any }>('/auth/phone-login', { userId, response }),
  // User
  getUserProfile: () => get<any>('/user/profile'),
  // Activity
  getActivities: () => get<any[]>('/activity'),
  getActivity: (id: number) => get<any>(`/activity/${id}`),
  getActivityDetail: (code: string) => get<any>(`/activity/detail?code=${code}`),
  // Banner
  getBanners: () => get<any[]>('/banner/list'),
  // Bottom Menu
  getBottomMenu: () => get<any[]>('/bottomMenu/list'),
  // Homepage Config (统一首页配置接口)
  getHomepageConfig: () => get<{ banners: any[]; hotActivities: any[]; hotNews: any[]; bottomMenus: any[]; adSlot: any }>('/homepage/config'),
  // News
  getNewsList: () => get<any[]>('/news/list'),
  getNewsDetail: (id: string) => get<any>(`/news/detail?id=${id}`),
  // Activity Form Submit
  checkActivityParticipation: (activityCode: string, phone: string) =>
    get<{ participated: boolean; lead?: { name: string; phone: string; leadInfo: any; createTime: string; agreementUrl: string } }>(`/activity-form/check?activityCode=${encodeURIComponent(activityCode)}&phone=${encodeURIComponent(phone)}`),
  submitActivityForm: (data: { activityCode: string; formData: Record<string, any>; agreementUrl?: string }) =>
    post<any>('/activity-form/submit', data),
  // 协议上传完成后回填 agreementUrl
  submitActivityAgreement: (data: { activityCode: string; phone: string; agreementUrl: string }) =>
    post<any>('/activity-form/update-agreement', data),
  // Clue (我的预约)
  getClues: () => get<any[]>('/clue'),
  getClue: (id: string) => get<any>(`/clue/${id}`),
  updateAgreement: (id: string, filePath: string): Promise<any> => {
    const token = (() => {
      try {
        return my.getStorageSync({ key: 'token' }).data as string || '';
      } catch { return ''; }
    })();
    return new Promise((resolve, reject) => {
      my.uploadFile({
        url: `http://localhost:3001/api/app/clue/${id}/agreement`,
        filePath,
        fileName: 'file',
        header: { 'Authorization': token ? `Bearer ${token}` : '' },
        success: (res: any) => {
          try {
            const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
            if (body.success === false || body.error) {
              reject(new Error(body.error || '上传失败'));
            } else {
              resolve(body.data || body);
            }
          } catch {
            reject(new Error('上传失败'));
          }
        },
        fail: reject,
      } as any);
    });
  },
  claimBenefit: (id: string) => post<any>(`/clue/${id}/claim-benefit`),
  // File upload (通用文件上传)
  uploadFile: (filePath: string): Promise<string> => {
    const token = (() => {
      try {
        return my.getStorageSync({ key: 'token' }).data as string || '';
      } catch { return ''; }
    })();
    return new Promise((resolve, reject) => {
      my.uploadFile({
        url: 'http://localhost:3001/api/platform/activity/uploadImage',
        filePath,
        fileName: 'file',
        header: { 'Authorization': token ? `Bearer ${token}` : '' },
        success: (res: any) => {
          try {
            const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
            resolve(body?.data?.url || res.data);
          } catch {
            resolve(res.data);
          }
        },
        fail: reject,
      } as any);
    });
  },
};

// 兼容直接 import { uploadFile } from '../../utils/api' 的导入方式
export const uploadFile = api.uploadFile;
