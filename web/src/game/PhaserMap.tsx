import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import type { FarmView } from '@core';
import { FarmScene, type SceneHooks } from './FarmScene';

/** Khung chứa bản đồ Phaser. `hooks` đọc qua ref để không phải dựng lại game. */
export function PhaserMap({ view, hooks }: { view: FarmView | null; hooks: SceneHooks }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<FarmScene | null>(null);
  const hooksRef = useRef(hooks);
  hooksRef.current = hooks;

  useEffect(() => {
    const s = new FarmScene();
    const el = host.current!;
    // vẽ ở độ phân giải thật của màn hình (dpr) rồi thu nhỏ hiển thị, để chữ và emoji không mờ
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const size = () => ({ w: Math.max(1, Math.round(el.clientWidth * dpr)), h: Math.max(1, Math.round(el.clientHeight * dpr)) });
    const first = size();
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: el,
      backgroundColor: '#14532d',
      scale: { mode: Phaser.Scale.NONE, width: first.w, height: first.h, zoom: 1 / dpr },
      render: { antialias: true },
      input: { touch: { capture: true } },
      banner: false,
    });
    const ro = new ResizeObserver(() => {
      const n = size();
      game.scale.resize(n.w, n.h);
      game.scale.setZoom(1 / dpr);
    });
    ro.observe(el);
    game.scene.add('farm', s, true, { hooks: { onArrive: (t) => hooksRef.current.onArrive(t), onNoPath: () => hooksRef.current.onNoPath() } satisfies SceneHooks });
    scene.current = s;
    return () => {
      ro.disconnect();
      scene.current = null;
      game.destroy(true);
    };
  }, []);

  useEffect(() => {
    if (view && scene.current) {
      const s = scene.current;
      if (s.sys?.isActive()) s.setView(view);
      else s.events.once('create', () => s.setView(view));
    }
  }, [view]);

  return <div ref={host} data-testid="farm-map" className="absolute inset-0 touch-none select-none" />;
}
