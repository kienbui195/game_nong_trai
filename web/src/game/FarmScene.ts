// Bản đồ nông trại vẽ bằng Phaser 3 (hình khối + emoji tạm, Q9). React lo mọi bảng và nút đè lên trên.
import Phaser from 'phaser';
import { ANIMAL_BY_ID, CROP_BY_ID, EXPANSION, HOUSE_RECT, MAP_COLS, MAP_ROWS, MARKET_RECT, doorOf, type FarmView, type Rect } from '@core';
import { blockedGrid, zoneAt, zones, type Target, type Zone } from './layout';
import { nearestStand, type Pt } from './path';

export interface SceneHooks {
  onArrive: (t: Target) => void;
  onNoPath: () => void;
}

const SEASON_GRASS: Record<string, number> = { spring: 0x7cc576, summer: 0x5fb34f, autumn: 0xc9a54a, winter: 0xdde8ee };
const STEP_MS = 110;
const PATH_ROWS = [4, 11];
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/**
 * Màn dọc vẽ bản đồ đúng 12 cột × 22 hàng, cuộn dọc. Màn ngang (desktop, điện thoại xoay ngang)
 * vẽ chuyển vị — hàng thành cột — thành 22 × 12 và co cho vừa trọn khung, không cuộn.
 * Toạ độ ô trong game (core, tìm đường, server) không đổi; chỉ cách vẽ đổi.
 */
export class FarmScene extends Phaser.Scene {
  private tile = 32;
  private rot = false; // true: màn ngang, vẽ chuyển vị
  private hooks!: SceneHooks;
  private view: FarmView | null = null;
  private zs: Zone[] = [];
  private blocked = blockedGrid();
  private layer!: Phaser.GameObjects.Container;
  private grass!: Phaser.GameObjects.Rectangle;
  private player!: Phaser.GameObjects.Text;
  private playerTile: Pt = doorOf(HOUSE_RECT);
  private walkId = 0;
  private drag: { y: number; scroll: number; moved: boolean } | null = null;

  constructor() {
    super('farm');
  }

  init(data: { hooks: SceneHooks }) {
    this.hooks = data.hooks;
  }

  create() {
    this.layout();
    this.scale.on('resize', () => this.layout());
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => (this.drag = { y: p.y, scroll: this.cameras.main.scrollY, moved: false }));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.drag || !p.isDown) return;
      const dy = p.y - this.drag.y;
      if (Math.abs(dy) > 8) this.drag.moved = true;
      if (this.drag.moved && !this.rot) this.cameras.main.scrollY = this.drag.scroll - dy;
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      this.drag = null;
      if (!d || d.moved) return; // kéo bản đồ: không đi (AC-02.3)
      const sx = Math.floor(p.worldX / this.tile);
      const sy = Math.floor(p.worldY / this.tile);
      const [x, y] = this.rot ? [sy, sx] : [sx, sy];
      if (x < 0 || y < 0 || x >= MAP_COLS || y >= MAP_ROWS) return;
      this.tapTile(x, y);
    });
  }

  setView(v: FarmView) {
    this.view = v;
    this.zs = zones(v);
    if (this.layer) this.redraw();
  }

  private layout() {
    const { width: w, height: h } = this.scale;
    this.rot = w > h;
    const cols = this.rot ? MAP_ROWS : MAP_COLS;
    const rows = this.rot ? MAP_COLS : MAP_ROWS;
    this.tile = Math.max(1, Math.floor(this.rot ? Math.min(w / cols, h / rows) : w / cols));
    const worldW = this.tile * cols;
    const worldH = this.tile * rows;
    const cam = this.cameras.main;
    if (this.rot) {
      // vừa trọn khung: đặt bản đồ vào giữa
      cam.removeBounds();
      cam.setScroll(-Math.floor((w - worldW) / 2), -Math.floor((h - worldH) / 2));
    } else {
      cam.setBounds(0, 0, worldW, Math.max(worldH, h));
    }
    this.children.removeAll(true);
    this.grass = this.add.rectangle(0, 0, worldW, worldH, SEASON_GRASS.spring).setOrigin(0);
    this.layer = this.add.container(0, 0);
    this.player = this.add.text(0, 0, '🧑‍🌾', { fontSize: `${Math.round(this.tile * 0.8)}px` }).setOrigin(0.5).setDepth(10);
    this.placePlayer(this.playerTile);
    this.redraw();
  }

  /** Điểm trên bản đồ (đơn vị ô, có thể lẻ) → pixel trên màn. */
  private pt(mx: number, my: number) {
    const [sx, sy] = this.rot ? [my, mx] : [mx, my];
    return { x: sx * this.tile, y: sy * this.tile };
  }

  /** Hình chữ nhật trên bản đồ → hình chữ nhật pixel trên màn. */
  private box(r: Rect) {
    const p = this.pt(r.x, r.y);
    return this.rot ? { ...p, w: r.h * this.tile, h: r.w * this.tile } : { ...p, w: r.w * this.tile, h: r.h * this.tile };
  }

  private rect(r: Rect, color: number, alpha = 1, inset = 0) {
    const b = this.box(r);
    return this.add.rectangle(b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2, color, alpha).setOrigin(0);
  }

  private textAt(x: number, y: number, s: string, scale: number) {
    return this.add.text(x, y, s, { fontSize: `${Math.max(8, Math.round(this.tile * scale))}px` }).setOrigin(0.5);
  }

  /** Emoji giữa ô (x, y) của bản đồ. */
  private emoji(x: number, y: number, s: string, scale = 0.7) {
    const p = this.pt(x + 0.5, y + 0.5);
    return this.textAt(p.x, p.y, s, scale);
  }

  /** Emoji ở góc trên-phải của công trình (theo màn, không theo bản đồ). */
  private corner(r: Rect, s: string, scale = 0.45) {
    const b = this.box(r);
    return this.textAt(b.x + b.w - this.tile / 2, b.y + this.tile / 2, s, scale);
  }

  private label(r: Rect, s: string) {
    const b = this.box(r);
    return this.add
      .text(b.x + b.w / 2, b.y + b.h - 2, s, {
        fontFamily: FONT,
        fontSize: `${Math.max(9, Math.round(this.tile * 0.32))}px`,
        color: '#1f2937',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: b.w - 4 }, // màn ngang chuồng chỉ rộng 2 ô: xuống dòng thay vì tràn
      })
      .setOrigin(0.5, 1);
  }

  private redraw() {
    this.layer.removeAll(true);
    const v = this.view;
    this.grass.setFillStyle(SEASON_GRASS[v?.season ?? 'spring']);
    const T = this.tile;
    const add = (o: Phaser.GameObjects.GameObject) => this.layer.add(o);
    // lối đi
    for (const y of PATH_ROWS) add(this.rect({ x: 0, y, w: MAP_COLS, h: 1 }, 0xd6c29a, 0.7));
    // nhà, chợ
    add(this.rect(HOUSE_RECT, 0xb45309).setStrokeStyle(2, 0x78350f));
    add(this.emoji(HOUSE_RECT.x + 1, HOUSE_RECT.y + 0.8, '🏠', 1.4));
    add(this.label(HOUSE_RECT, v?.sleeping ? 'Nhà 💤' : 'Nhà'));
    add(this.rect(MARKET_RECT, 0x2563eb).setStrokeStyle(2, 0x1e3a8a));
    add(this.emoji(MARKET_RECT.x + 1, MARKET_RECT.y + 0.8, '🏪', 1.4));
    add(this.label(MARKET_RECT, 'Chợ'));
    if (!v) return;

    for (const z of this.zs) {
      const r = z.rect;
      const t = z.target;
      if (t.kind === 'lockedPlot') {
        add(this.rect(r, 0x000000, 0, 2).setStrokeStyle(1, 0x6b7280, 0.5));
      } else if (t.kind === 'plot') {
        const plot = v.plots[t.plotId];
        const c = plot.crop;
        const soil = c && !c.dry ? 0x5b3a1e : 0x8b5a2b;
        add(this.rect(r, soil, 1, 1));
        if (c) {
          const def = CROP_BY_ID[c.cropId];
          const ready = c.stage === 'ripe' || c.stage === 'fruit';
          const scale = c.stage === 'withered' ? 0.6 : ready || c.stage === 'mature' ? 0.75 : 0.35 + 0.35 * c.progress;
          add(this.emoji(r.x, r.y, c.stage === 'withered' ? '🥀' : c.progress < 0.25 && c.stage === 'growing' ? '🌱' : def.emoji, scale));
          const mark = c.pestSince !== null ? '🐛' : c.stage === 'sleeping' ? '💤' : ready ? '✨' : c.dry ? '💧' : c.recoverMs > 0 ? '🩹' : '';
          const b = this.box(r);
          if (mark) add(this.add.text(b.x + b.w - 2, b.y + 1, mark, { fontSize: `${Math.round(T * 0.34)}px` }).setOrigin(1, 0));
        }
      } else if (t.kind === 'emptyBuilding') {
        add(this.rect(r, 0xffffff, 0.15, 3).setStrokeStyle(1, 0xffffff, 0.6));
        add(this.emoji(r.x + (r.w - 1) / 2, r.y + (r.h - 1) / 2 - 0.15, '＋', 0.55));
        add(this.label(r, EXPANSION.build[t.type].label));
      } else if (t.kind === 'building') {
        const b = v.buildings.find((x) => x.id === t.buildingId)!;
        if (b.type === 'pond') {
          const pond = v.ponds.find((p) => p.buildingId === b.id)!;
          add(this.rect(r, 0x3b82f6).setStrokeStyle(2, 0x1d4ed8));
          pond.fish.slice(0, 8).forEach((f, i) => add(this.emoji(r.x + (i % 4), r.y + Math.floor(i / 4), f.emoji, 0.5)));
          if (pond.sick || pond.hungry) add(this.corner(r, pond.sick ? '🤒' : '🍽️'));
          add(this.label(r, `Ao ${pond.fish.length}/${b.capacity}`));
        } else {
          add(this.rect(r, b.type === 'coop' ? 0xf59e0b : 0x92400e).setStrokeStyle(2, 0x451a03));
          const list = v.animals.filter((a) => a.buildingId === b.id);
          list.slice(0, 6).forEach((a, i) => add(this.emoji(r.x + (i % 3), r.y + Math.floor(i / 3) * 0.9, ANIMAL_BY_ID[a.species].emoji, a.mature ? 0.6 : 0.42)));
          const need = list.some((a) => a.product) ? '🥚' : list.some((a) => a.sick) ? '🤒' : list.some((a) => a.hungry) ? '🍽️' : '';
          if (need) add(this.corner(r, need));
          add(this.label(r, `${EXPANSION.build[b.type].label} ${list.length}/${b.capacity}`));
        }
      }
    }
  }

  private placePlayer(p: Pt) {
    this.playerTile = p;
    const c = this.pt(p.x + 0.5, p.y + 0.5);
    this.player.setPosition(c.x, c.y);
  }

  private tapTile(x: number, y: number) {
    const z = zoneAt(this.zs, x, y);
    const dest = z ? z.stand : { x, y };
    const path = nearestStand(this.blocked, this.playerTile, dest);
    if (!path) return this.hooks.onNoPath();
    this.walk(path, z?.target ?? null);
  }

  /** Đi từng ô; đang đi mà chạm chỗ khác thì đổi đích ngay (AC-02.2). */
  private walk(path: Pt[], target: Target | null) {
    const id = ++this.walkId;
    this.tweens.killTweensOf(this.player);
    const steps = path.slice(1);
    const next = () => {
      if (id !== this.walkId) return;
      const p = steps.shift();
      if (!p) {
        if (target) this.hooks.onArrive(target);
        return;
      }
      this.playerTile = p;
      const c = this.pt(p.x + 0.5, p.y + 0.5);
      this.tweens.add({ targets: this.player, x: c.x, y: c.y, duration: STEP_MS, onComplete: next });
      this.followPlayer();
    };
    next();
  }

  private followPlayer() {
    if (this.rot) return; // màn ngang: cả bản đồ đã nằm trong khung
    const cam = this.cameras.main;
    const y = this.playerTile.y * this.tile;
    if (y < cam.scrollY + this.tile * 2 || y > cam.scrollY + cam.height - this.tile * 3) cam.pan(cam.midPoint.x, y, 250);
  }
}
