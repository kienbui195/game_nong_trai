// Trạng thái game phía giao diện: dữ liệu mới nhất từ server, trạng thái mạng, gửi thao tác.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { Action, FarmView, GameError } from '@core';
import { ApiError, NetError, loadFarm, newActionId, sendAction } from './api';

type Online = 'ok' | 'offline';

interface FarmCtx {
  view: FarmView | null;
  online: Online;
  pending: boolean;
  /** Gửi thao tác. Trả lỗi game (nếu có) để nơi gọi xử lý tiếp (vd hỏi xác nhận). */
  act: (a: Action, opts?: { quiet?: boolean; success?: string }) => Promise<GameError | null>;
  refresh: () => Promise<void>;
  onLogout: () => void;
}

const Ctx = createContext<FarmCtx | null>(null);
export const useFarm = () => useContext(Ctx)!;

export function FarmProvider({ children, onLogout }: { children: ReactNode; onLogout: () => void }) {
  const [view, setView] = useState<FarmView | null>(null);
  const [online, setOnline] = useState<Online>('ok');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);

  const handle = useCallback(
    (e: unknown) => {
      if (e instanceof NetError) setOnline('offline');
      else if (e instanceof ApiError && e.status === 401) onLogout();
      else toast.error(e instanceof Error ? e.message : 'Có lỗi.');
    },
    [onLogout],
  );

  const refresh = useCallback(async () => {
    try {
      const r = await loadFarm();
      setView(r.view);
      setOnline('ok');
    } catch (e) {
      handle(e);
    }
  }, [handle]);

  const act = useCallback<FarmCtx['act']>(
    async (a, opts) => {
      if (busy.current) return null; // khoá trong lúc chờ server (bấm đúp)
      busy.current = true;
      setPending(true);
      const id = newActionId();
      try {
        let r;
        try {
          r = await sendAction(a, id);
        } catch (e) {
          if (!(e instanceof NetError)) throw e;
          r = await sendAction(a, id); // gửi lại cùng mã: server không làm lần hai (BR30)
        }
        setView(r.view);
        setOnline('ok');
        if (!r.ok && r.error) {
          if (!opts?.quiet) toast.error(r.error.message);
          return r.error;
        }
        if (opts?.success) toast.success(opts.success);
        navigator.vibrate?.(15);
        return null;
      } catch (e) {
        handle(e);
        return { code: 'net', message: 'Mất kết nối.' };
      } finally {
        busy.current = false;
        setPending(false);
      }
    },
    [handle],
  );

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 30_000);
    const vis = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [refresh]);

  const value = useMemo(() => ({ view, online, pending, act, refresh, onLogout }), [view, online, pending, act, refresh, onLogout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
