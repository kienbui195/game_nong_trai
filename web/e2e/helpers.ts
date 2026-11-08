// Dùng chung cho các spec e2e. Mỗi test: tự reset dữ liệu trước, tự kiểm trang không cuộn + không lỗi console sau.
import { test as base, expect, type Page } from '@playwright/test';
import { MAP_COLS, MAP_ROWS } from '../../core/src/map';

export const API = 'http://127.0.0.1:45330';
export const ADMIN_TOKEN = 'admin-e2e-token-admin-e2e-token-admin-e2e-token';
export const H = 3_600_000;
export const MIN = 60_000;

/** Câu hỏi e2e: đáp án đúng luôn bắt đầu bằng "Đúng" để bài test chọn được (đáp án bị xáo khi nhận việc). */
export function csvQuestions(perLevel: number, levels: number) {
  const rows = [['do_kho', 'cau_hoi', 'dap_an_a', 'dap_an_b', 'dap_an_c', 'dap_an_d', 'dap_an_dung']];
  for (let l = 1; l <= levels; l++)
    for (let i = 1; i <= perLevel; i++) rows.push([String(l), `[e2e] Câu ${l}-${i}?`, `Đúng ${l}-${i}`, `Sai ${l}-${i}-b`, `Sai ${l}-${i}-c`, `Sai ${l}-${i}-d`, 'A']);
  return rows.map((r) => r.join(',')).join('\r\n');
}

export const e2e = (path: string) => fetch(`${API}${path}`, { method: 'POST' }).then((r) => r.json());
/** Tua giờ server (mọi tính bù, hạn câu hỏi, đồng hồ giao diện đi theo). */
export const advance = (ms: number) => e2e(`/__e2e/clock?advance=${ms}`);
/** Đặt xu / thêm đồ vào kho của người chơi (dựng điều kiện trước), rồi tải lại để giao diện thấy. */
export async function grant(page: Page, username: string, q: { coins?: number; item?: string; n?: number }) {
  const qs = new URLSearchParams({ username, ...Object.fromEntries(Object.entries(q).map(([k, v]) => [k, String(v)])) });
  const r = await fetch(`${API}/__e2e/grant?${qs}`, { method: 'POST' });
  if (!r.ok) throw new Error(`grant lỗi ${r.status} ${await r.text()}`);
  await reopen(page);
}

export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      await e2e('/__e2e/reset');
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => {
        // phản hồi 4xx là luật chơi / xác thực từ chối có chủ đích, giao diện tự xử lý; 5xx và lỗi JS vẫn bị bắt
        if (m.type() === 'error' && !/Failed to load resource: the server responded with a status of 4\d\d/.test(m.text())) errors.push(m.text());
      });
      await use(errors);
      // MOBILE_WEB §8: sau mọi thao tác, trang không cuộn
      expect(await page.evaluate(() => document.scrollingElement?.scrollTop ?? 0), 'trang bị cuộn').toBe(0);
      expect(errors, 'lỗi console').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export async function register(page: Page, name = 'Nam', password = 'matkhau1') {
  await page.goto('/');
  await page.fill('#dn', name);
  await page.fill('#pw1', password);
  await page.getByTestId('register').click();
  const username = (await page.getByTestId('new-username').textContent())!.trim();
  await page.getByTestId('enter-farm').click();
  await expect(page.getByTestId('hud-coins')).toBeVisible();
  await page.waitForTimeout(800); // Phaser dựng cảnh
  return { username, password };
}

/** Ô (x, y) của bản đồ → điểm giữa ô trên màn. Màn dọc: 12×22 vừa khung Pixel 7, không cần cuộn camera.
 *  Màn ngang: vẽ chuyển vị 22×12, co vừa khung và đặt giữa (xem FarmScene). */
export async function tilePoint(page: Page, x: number, y: number) {
  const box = (await page.getByTestId('farm-map').locator('canvas').boundingBox())!;
  if (box.width <= box.height) {
    const t = box.width / MAP_COLS;
    return { x: box.x + (x + 0.5) * t, y: box.y + (y + 0.5) * t, tile: t };
  }
  const t = Math.min(box.width / MAP_ROWS, box.height / MAP_COLS);
  const ox = (box.width - t * MAP_ROWS) / 2;
  const oy = (box.height - t * MAP_COLS) / 2;
  return { x: box.x + ox + (y + 0.5) * t, y: box.y + oy + (x + 0.5) * t, tile: t };
}

/** Chạm vào giữa một ô bản đồ (toạ độ ô). */
export async function tapTile(page: Page, x: number, y: number) {
  // chạm lúc hộp thoại còn đang đóng thì bị nuốt mất: chờ đóng hẳn
  await expect(page.locator('[role=dialog]')).toHaveCount(0);
  const p = await tilePoint(page, x, y);
  await page.touchscreen.tap(p.x, p.y);
}

export const coins = async (page: Page) => Number((await page.getByTestId('hud-coins').textContent())!.replace(/\D/g, ''));
export const stamina = async (page: Page) => Number((await page.getByTestId('hud-stamina').textContent())!.split('/')[0].replace(/\D/g, ''));
/** Tải lại nông trại từ server (như mở lại app). */
export async function reopen(page: Page) {
  await page.reload();
  await expect(page.getByTestId('hud-coins')).toBeVisible();
  await page.waitForTimeout(800);
}

/** Đóng hộp thoại / bảng việc đang mở và chờ đóng hẳn. */
export async function closeSheet(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.locator('[role=dialog]')).toHaveCount(0);
}

/** Chạm một ô rồi chờ nhân vật đi tới và bảng việc mở ra. */
export async function openTile(page: Page, x: number, y: number) {
  await tapTile(page, x, y);
  await expect(page.locator('[role=dialog]')).toBeVisible({ timeout: 15_000 });
}

/** Vào chợ, tab mua, mua 1 món. */
export async function buy(page: Page, itemId: string) {
  await openTile(page, 9, 2);
  await page.getByTestId('tab-buy').click();
  const before = await coins(page);
  await page.locator(`[data-testid="buy-row-${itemId}"] [data-testid=buy]`).click();
  await expect.poll(() => coins(page)).toBeLessThan(before);
  await closeSheet(page);
}

/** Vào nhà (ô 2,2). */
export const openHouse = (page: Page) => openTile(page, 2, 2);

/** AC-11.1: mọi nút đang hiện trong hộp thoại / bảng việc có vùng chạm tối thiểu 44×44 px. */
export async function expectTapTargets(page: Page) {
  // hộp thoại mở bằng hiệu ứng phóng (transform scale 95%→100%): đo khi hiệu ứng chạy xong, không thì nút 44px đo ra 43px
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('[role=dialog] button, [role=dialog] [role=tab]')]
      .filter((b) => (b as HTMLElement).offsetParent !== null)
      .map((b) => ({ t: (b.textContent ?? b.getAttribute('aria-label') ?? '').trim().slice(0, 30), r: b.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.height < 43.5 || r.width < 43.5))
      .map(({ t, r }) => `${t || '(icon)'} ${Math.round(r.width)}×${Math.round(r.height)}`),
  );
  expect(small, 'nút nhỏ hơn 44px').toEqual([]);
}
