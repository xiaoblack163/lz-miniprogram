const TOKEN_KEY = 'token';
const USER_INFO_KEY = 'userInfo';

export function getToken(): string {
  try {
    const res = my.getStorageSync({ key: TOKEN_KEY });
    return (res.data as string) || '';
  } catch {
    return '';
  }
}

export function setToken(token: string): void {
  try {
    my.setStorageSync({ key: TOKEN_KEY, data: token });
  } catch (e) {
    console.error('setToken failed:', e);
  }
}

export function clearToken(): void {
  try {
    my.removeStorageSync({ key: TOKEN_KEY });
    my.removeStorageSync({ key: USER_INFO_KEY });
  } catch (e) {
    console.error('clearToken failed:', e);
  }
}

export function isLogin(): boolean {
  return !!getToken();
}

export function setUserInfo(userInfo: any): void {
  try {
    my.setStorageSync({ key: USER_INFO_KEY, data: userInfo });
  } catch (e) {
    console.error('setUserInfo failed:', e);
  }
}

export function getUserInfo(): any {
  try {
    const res = my.getStorageSync({ key: USER_INFO_KEY });
    return (res.data as any) || null;
  } catch {
    return null;
  }
}
