import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';
export const API_BASE = isWeb ? '' : 'https://fountain-gate-academy.onrender.com';

const COOKIE_KEY = 'fga_session_cookie';
let cookie = null;

export async function loadCookie() {
  if (isWeb) return;
  try {
    cookie = (await AsyncStorage.getItem(COOKIE_KEY)) || null;
  } catch {
    cookie = null;
  }
}

export async function clearCookie() {
  cookie = null;
  if (isWeb) return;
  try {
    await AsyncStorage.removeItem(COOKIE_KEY);
  } catch {
    // ignore storage failures
  }
}

function captureCookie(response) {
  if (isWeb) return;
  let raw = '';
  try {
    if (typeof response.headers.getSetCookie === 'function') {
      raw = response.headers.getSetCookie().join('; ');
    } else {
      raw = response.headers.get('set-cookie') || '';
    }
  } catch {
    raw = '';
  }
  const match = raw.match(/keystone\.sid=[^;,\s]+/);
  if (match) {
    cookie = match[0];
    AsyncStorage.setItem(COOKIE_KEY, cookie).catch(() => {});
  }
}

async function send(path, options = {}) {
  const response = await fetch(API_BASE + path, { credentials: 'same-origin', ...options });
  captureCookie(response);
  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  return { response, data };
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (!isWeb && cookie) headers.Cookie = cookie;

  if (method !== 'GET' && method !== 'HEAD') {
    const csrfHeaders = !isWeb && cookie ? { Cookie: cookie } : {};
    const { data } = await send('/api/csrf', { method: 'GET', headers: csrfHeaders });
    if (data && data.token) headers['X-CSRF-Token'] = data.token;
  }

  const options = { method, headers };
  if (body !== undefined) options.body = JSON.stringify(body);

  let result;
  try {
    result = await send(path, options);
  } catch (error) {
    const networkError = new Error('Cannot reach the server. Check your connection and try again.');
    networkError.isNetwork = true;
    throw networkError;
  }

  const { response, data } = result;
  if (!response.ok) {
    const error = new Error((data && data.error) || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function getCsrfToken() {
  const { data } = await send('/api/csrf', { headers: cookie ? { Cookie: cookie } : {} });
  return data ? data.token : null;
}
