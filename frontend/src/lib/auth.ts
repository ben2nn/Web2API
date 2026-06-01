export function getAuthHeader() {
  const key = localStorage.getItem('Web2API_key') || 'admin';
  return { Authorization: `Bearer ${key}` };
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem('Web2API_key');
}

export function logout() {
  localStorage.removeItem('Web2API_key');
  window.location.href = '/login';
}

export function isAnonymousEnabled(): boolean {
  return localStorage.getItem('Web2API_anonymous') === 'true';
}

export function clearAnonymousToken() {
  // 清除匿名 token 缓存（刷新浏览器时调用）
  localStorage.removeItem('Web2API_anonymous_token');
}

export function getAnonymousToken(): string | null {
  return localStorage.getItem('Web2API_anonymous_token');
}

export function setAnonymousToken(token: string) {
  localStorage.setItem('Web2API_anonymous_token', token);
}
