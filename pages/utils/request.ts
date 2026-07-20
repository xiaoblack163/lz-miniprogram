import { getToken, clearToken } from './auth';

const BASE_URL = 'http://localhost:3001/api/app';
const IMG_HOST = 'http://localhost:3001/';

export function resolveImage(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${IMG_HOST}${url.startsWith('/') ? url.slice(1) : url}`;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'TRACE' | 'CONNECT';

interface RequestOptions {
  method?: HttpMethod;
  data?: any;
  [key: string]: any;
}

export async function request<T>(url: string, options?: RequestOptions): Promise<T> {
  const token = getToken();
  return new Promise((resolve, reject) => {
    my.request({
      url: BASE_URL + url,
      method: options?.method || 'GET',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
      data: options?.data,
      success: (res: any) => {
        // 统一处理响应格式 { success, data, error, msg }
        const body = res.data || res;
        if (body.success === false || body.error) {
          const errMsg = (body.error && body.error !== '{}' && body.error !== 'undefined') ? body.error : (body.msg || '请求失败');
          reject(new Error(errMsg));
        } else {
          resolve(body.data !== undefined ? body.data : body);
        }
      },
      fail: (err: any) => {
        // 支付宝小程序把 HTTP 401 走 fail 回调
        const httpStatus = err.status || err.statusCode;
        if (httpStatus === 401) {
          clearToken();
          my.showToast({ content: '登录已过期，请重新登录', type: 'none' });
          setTimeout(() => {
            my.reLaunch({ url: '/pages/login/login' });
          }, 1000);
        }
        reject(err);
      },
    });
  });
}

export function get<T>(url: string): Promise<T> {
  return request<T>(url, { method: 'GET' });
}

export function post<T>(url: string, data?: any): Promise<T> {
  return request<T>(url, { method: 'POST', data });
}

export function put<T>(url: string, data?: any): Promise<T> {
  return request<T>(url, { method: 'PUT', data });
}
