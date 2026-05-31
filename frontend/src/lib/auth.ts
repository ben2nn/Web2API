export function getAuthHeader() {
  const key = localStorage.getItem('qwen2api_key') || 'admin';
  return { Authorization: `Bearer ${key}` };
}

export function isAnonymousEnabled(): boolean {
  return localStorage.getItem('qwen2api_anonymous') === 'true';
}

export function clearAnonymousToken() {
  // 清除匿名 token 缓存（刷新浏览器时调用）
  localStorage.removeItem('qwen2api_anonymous_token');
}

export function getAnonymousToken(): string | null {
  return localStorage.getItem('qwen2api_anonymous_token');
}

export function setAnonymousToken(token: string) {
  localStorage.setItem('qwen2api_anonymous_token', token);
}
