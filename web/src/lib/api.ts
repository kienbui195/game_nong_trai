// Gọi server. Phiên lưu ở localStorage để lỡ tải lại vẫn vào đúng nông trại.
import type { Action, FarmView, GameError } from '@core';

const TOKEN_KEY = 'nongtrai_token';
const API = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

let offset = 0; // giờ server − giờ máy
export const serverNow = () => Date.now() + offset;

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const setToken = (t: string | null) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* trình duyệt chặn lưu: vẫn chơi được trong phiên này */
  }
};

/** Tên đăng nhập đọc từ phiên (trường `un` của JWT), để nhắc người chơi trước khi đăng xuất */
export const tokenUsername = (): string | null => {
  try {
    const part = getToken()?.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const un = (JSON.parse(json) as { un?: unknown }).un;
    return typeof un === 'string' ? un : null;
  } catch {
    return null;
  }
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}
/** Mất mạng hoặc server không trả lời */
export class NetError extends Error {}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  let r: Response;
  try {
    const token = getToken();
    r = await fetch(API + path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new NetError('Mất kết nối.');
  }
  const text = await r.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* không phải JSON */
  }
  const d = data as { serverNow?: number; message?: string } | null;
  if (d && typeof d.serverNow === 'number') offset = d.serverNow - Date.now();
  if (r.status === 502 || r.status === 503 || r.status === 504) throw new NetError('Server không trả lời.');
  if (!r.ok && r.status !== 409) throw new ApiError(r.status, typeof d?.message === 'string' ? d.message : 'Có lỗi.', data);
  return data as T;
}

export interface AuthResult {
  user: { id: number; username: string; displayName: string };
  token: string;
}
export const register = (displayName: string, password: string) => req<AuthResult>('POST', '/api/auth/register', { displayName, password });
export const login = (username: string, password: string) => req<AuthResult>('POST', '/api/auth/login', { username, password });
export const loadFarm = () => req<{ view: FarmView; serverNow: number }>('GET', '/api/farm');

export interface ActResponse {
  ok: boolean;
  error?: GameError;
  replay?: boolean;
  view: FarmView;
}
export const newActionId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);
export const sendAction = (action: Action, id = newActionId()) => req<ActResponse>('POST', '/api/farm/actions', { id, action });
