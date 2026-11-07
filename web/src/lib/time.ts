import { useEffect, useState } from 'react';
import { serverNow } from './api';

/** Giờ server, cập nhật mỗi `ms`. */
export function useNow(ms = 1000) {
  const [t, setT] = useState(serverNow());
  useEffect(() => {
    const id = setInterval(() => setT(serverNow()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return t;
}

export function fmtLeft(ms: number) {
  if (ms <= 0) return 'xong';
  const s = Math.ceil(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d} ngày ${h} giờ`;
  if (h) return `${h} giờ ${m} phút`;
  if (m) return `${m} phút`;
  return `${s} giây`;
}

export const fmtClock = (t: number) => {
  const d = new Date(t);
  const hm = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(new Date(serverNow()))) / 86_400_000);
  return diff === 0 ? hm : diff === 1 ? `${hm} mai` : diff === -1 ? `${hm} hôm qua` : `${hm} ${d.getDate()}/${d.getMonth() + 1}`;
};
export const pct = (x: number) => `${Math.round(Math.max(0, Math.min(1, x)) * 100)}%`;
