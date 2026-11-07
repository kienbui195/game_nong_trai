// PWA: gợi ý cài lên màn hình chính, giữ màn hình sáng khi chơi.
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const HIDE_KEY = 'nongtrai_install_hint_hidden';
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

interface BeforeInstallPrompt extends Event {
  prompt: () => Promise<void>;
}

export function InstallHint() {
  const [evt, setEvt] = useState<BeforeInstallPrompt | null>(null);
  const [hidden, setHidden] = useState(() => {
    try {
      return standalone() || localStorage.getItem(HIDE_KEY) === '1';
    } catch {
      return standalone();
    }
  });
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  if (hidden || (!evt && !ios)) return null;
  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem(HIDE_KEY, '1');
    } catch {
      /* không lưu được thì thôi */
    }
  };
  return (
    <div className="z-10 flex shrink-0 items-center gap-2 bg-amber-100 px-3 py-2 text-sm text-amber-950">
      <span className="flex-1">{ios ? 'Cài như app: bấm nút Chia sẻ → "Thêm vào MH chính".' : 'Cài lên màn hình chính để chơi toàn màn hình.'}</span>
      {evt && (
        <button className="h-9 rounded-md bg-amber-600 px-3 font-medium text-white" onClick={() => evt.prompt().then(hide)}>
          Cài
        </button>
      )}
      <button className="flex size-9 items-center justify-center" aria-label="Ẩn" onClick={hide}>
        <X className="size-4" />
      </button>
    </div>
  );
}

export function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const get = async () => {
      try {
        lock = (await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen')) ?? null;
      } catch {
        /* không hỗ trợ hoặc bị từ chối */
      }
    };
    const vis = () => document.visibilityState === 'visible' && void get();
    void get();
    document.addEventListener('visibilitychange', vis);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}

export function registerSW() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
  }
}
