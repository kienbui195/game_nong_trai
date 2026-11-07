// Bản đồ nông trại vẽ bằng Phaser 3 (hình khối + emoji tạm, Q9). React lo mọi bảng và nút đè lên trên.
import Phaser from 'phaser';
import { ANIMAL_BY_ID, CROP_BY_ID, HOUSE_RECT, MAP_COLS, MAP_ROWS, MARKET_RECT, doorOf, type FarmView, type Rect } from '@core';
import { blockedGrid, zoneAt, zones, type Target, type Zone } from './layout';
import { nearestStand, type Pt } from './path';

export interface SceneHooks {
  onArrive: (t: Target) => void;
  onNoPath: () => void;
}

const SEASON_GRASS: Record<string, number> = { spring: 0x7cc576, summer: 0x5fb34f, autumn: 0xc9a54a, winter: 0xdde8ee };
const STEP_MS = 110;

export class FarmScene extends Phaser.Scene {
  private tile = 32;
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
      if (this.drag.moved) this.cameras.main.scrollY = this.drag.scroll - dy;
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      this.drag = null;
      if (!d || d.moved) return; // kéo bản đồ: không đi (AC-02.3)
      const x = Math.floor(p.worldX / this.tile);
      const y = Math.floor(p.worldY / this.tile);
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
    const w = this.scale.width;
    this.tile = Math.floor(w / MAP_COLS);
    const worldH = this.tile * MAP_ROWS;
    this.cameras.main.setBounds(0, 0, this.tile * MAP_COLS, Math.max(worldH, this.scale.height));
    this.children.removeAll(true);
    this.grass = this.add.rectangle(0, 0, this.tile * MAP_COLS, worldH, SEASON_GRASS.spring).setOrigin(0);
    this.layer = this.add.container(0, 0);
    this.player = this.add.text(0, 0, '🧑‍🌾', { fontSize: `${Math.round(this.tile * 0.8)}px` }).setOrigin(0.5).setDepth(10);
    this.placePlayer(this.playerTile);
    this.redraw();
  }

  private px(t: number) {
    return t * this.tile;
  }

  private emoji(x: number, y: number, s: string, scale = 0.7) {
    return this.add.text(this.px(x) + this.tile / 2, this.px(y) + this.tile / 2, s, { fontSize: `${Math.max(8, Math.round(this.tile * scale))}px` }).setOrigin(0.5);
  }

  private label(r: Rect, s: string) {
    return this.add
      .text(this.px(r.x) + (r.w * this.tile) / 2, this.px(r.y + r.h) - 2, s, { fontSize: `${Math.max(9, Math.round(this.tile * 0.32))}px`, color: '#1f2937', fontStyle: 'bold' })
      .setOrigin(0.5, 1);
  }

  private redraw() {
    this.layer.removeAll(true);
    const v = this.view;
    this.grass.setFillStyle(SEASON_GRASS[v?.season ?? 'spring']);
    const T = this.tile;
    const add = (o: Phaser.GameObjects.GameObject) => this.layer.add(o);
    // lối đi
    add(this.add.rectangle(0, this.px(4), T * MAP_COLS, T, 0xd6c29a, 0.7).setOrigin(0));
    add(this.add.rectangle(0, this.px(11), T * MAP_COLS, T, 0xd6c29a, 0.7).setOrigin(0));
    // nhà, chợ
    add(this.add.rectangle(this.px(HOUSE_RECT.x), this.px(HOUSE_RECT.y), HOUSE_RECT.w * T, HOUSE_RECT.h * T, 0xb45309).setOrigin(0).setStrokeStyle(2, 0x78350f));
    add(this.emoji(HOUSE_RECT.x + 1, HOUSE_RECT.y + 0.8, '🏠', 1.4));
    add(this.label(HOUSE_RECT, v?.sleeping ? 'Nhà 💤' : 'Nhà'));
    add(this.add.rectangle(this.px(MARKET_RECT.x), this.px(MARKET_RECT.y), MARKET_RECT.w * T, MARKET_RECT.h * T, 0x2563eb).setOrigin(0).setStrokeStyle(2, 0x1e3a8a));
    add(this.emoji(MARKET_RECT.x + 1, MARKET_RECT.y + 0.8, '🏪', 1.4));
    add(this.label(MARKET_RECT, 'Chợ'));
    if (!v) return;

    for (const z of this.zs) {
      const r = z.rect;
      const t = z.target;
      if (t.kind === 'lockedPlot') {
        add(this.add.rectangle(this.px(r.x) + 2, this.px(r.y) + 2, T - 4, T - 4, 0x000000, 0).setOrigin(0).setStrokeStyle(1, 0x6b7280, 0.5));
      } else if (t.kind === 'plot') {
        const plot = v.plots[t.plotId];
        const c = plot.crop;
        const soil = c && !c.dry ? 0x5b3a1e : 0x8b5a2b;
        add(this.add.rectangle(this.px(r.x) + 1, this.px(r.y) + 1, T - 2, T - 2, soil).setOrigin(0));
        if (c) {
          const def = CROP_BY_ID[c.cropId];
          const ready = c.stage === 'ripe' || c.stage === 'fruit';
          const scale = c.stage === 'withered' ? 0.6 : ready || c.stage === 'mature' ? 0.75 : 0.35 + 0.35 * c.progress;
          add(this.emoji(r.x, r.y, c.stage === 'withered' ? '🥀' : c.progress < 0.25 && c.stage === 'growing' ? '🌱' : def.emoji, scale));
          const mark = c.pestSince !== null ? '🐛' : c.stage === 'sleeping' ? '💤' : ready ? '✨' : c.dry ? '💧' : c.recoverMs > 0 ? '🩹' : '';
          if (mark) add(this.add.text(this.px(r.x + 1) - 2, this.px(r.y) + 1, mark, { fontSize: `${Math.round(T * 0.34)}px` }).setOrigin(1, 0));
        }
      } else if (t.kind === 'emptyBuilding') {
        add(this.add.rectangle(this.px(r.x) + 3, this.px(r.y) + 3, r.w * T - 6, r.h * T - 6, 0xffffff, 0.15).setOrigin(0).setStrokeStyle(1, 0xffffff, 0.6));
        add(this.emoji(r.x + (r.w - 1) / 2, r.y + (r.h - 1) / 2 - 0.15, '＋', 0.55));
        add(this.label(r, t.type === 'coop' ? 'Chuồng gà' : t.type === 'barn' ? 'Chuồng bò' : 'Ao cá'));
      } else if (t.kind === 'building') {
        const b = v.buildings.find((x) => x.id === t.buildingId)!;
        if (b.type === 'pond') {
          const pond = v.ponds.find((p) => p.buildingId === b.id)!;
          add(this.add.rectangle(this.px(r.x), this.px(r.y), r.w * T, r.h * T, 0x3b82f6).setOrigin(0).setStrokeStyle(2, 0x1d4ed8));
          pond.fish.slice(0, 8).forEach((f, i) => add(this.emoji(r.x + (i % 4), r.y + Math.floor(i / 4), f.emoji, 0.5)));
          if (pond.sick || pond.hungry) add(this.emoji(r.x + r.w - 1, r.y, pond.sick ? '🤒' : '🍽️', 0.45));
          add(this.label(r, `Ao ${pond.fish.length}/${b.capacity}`));
        } else {
          add(this.add.rectangle(this.px(r.x), this.px(r.y), r.w * T, r.h * T, b.type === 'coop' ? 0xf59e0b : 0x92400e).setOrigin(0).setStrokeStyle(2, 0x451a03));
          const list = v.animals.filter((a) => a.buildingId === b.id);
          list.slice(0, 6).forEach((a, i) => add(this.emoji(r.x + (i % 3), r.y + Math.floor(i / 3) * 0.9, ANIMAL_BY_ID[a.species].emoji, a.mature ? 0.6 : 0.42)));
          const need = list.some((a) => a.product) ? '🥚' : list.some((a) => a.sick) ? '🤒' : list.some((a) => a.hungry) ? '🍽️' : '';
          if (need) add(this.emoji(r.x + r.w - 1, r.y, need, 0.45));
          add(this.label(r, `${b.type === 'coop' ? 'Chuồng gà vịt' : 'Chuồng gia súc'} ${list.length}/${b.capacity}`));
        }
      }
    }
  }

  private placePlayer(p: Pt) {
    this.playerTile = p;
    this.player.setPosition(this.px(p.x) + this.tile / 2, this.px(p.y) + this.tile / 2);
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
      this.tweens.add({ targets: this.player, x: this.px(p.x) + this.tile / 2, y: this.px(p.y) + this.tile / 2, duration: STEP_MS, onComplete: next });
      this.followPlayer();
    };
    next();
  }

  private followPlayer() {
    const cam = this.cameras.main;
    const y = this.px(this.playerTile.y);
    if (y < cam.scrollY + this.tile * 2 || y > cam.scrollY + cam.height - this.tile * 3) cam.pan(cam.midPoint.x, y, 250);
  }
}
