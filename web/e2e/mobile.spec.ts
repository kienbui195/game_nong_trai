// US-11 chạy như app trên điện thoại (AC-11.1, AC-11.2 phần kiểm tự động được) — MOBILE_WEB.md
import type { Page } from '@playwright/test';
import { closeSheet, expect, openTile, register, test } from './helpers';

async function drag(page: Page, x: number, y0: number, y1: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + ((y1 - y0) * i) / 12 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(600);
}
const mark = (page: Page) => page.evaluate(() => ((window as unknown as { __mark: number }).__mark = 42));
const marked = (page: Page) => page.evaluate(() => (window as unknown as { __mark?: number }).__mark === 42);
const pageButtonsSmall = async (page: Page) => {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  return page.evaluate(() =>
    [...document.querySelectorAll('button, [role=tab], a[href]')]
      .filter((b) => (b as HTMLElement).offsetParent !== null && !b.closest('[aria-label^="Notifications"]') && !b.classList.contains('sr-only')) // sr-only: chỉ cho trình đọc màn hình
      .map((b) => ({ t: (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 20), r: b.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.width < 43.5 || r.height < 43.5))
      .map(({ t, r }) => `${t} ${Math.round(r.width)}×${Math.round(r.height)}`),
  );
};

test('AC-11.1 kéo mạnh xuống ở mọi màn không tải lại, chạm đúp không phóng to, cuộn hết bảng dài trang không cuộn, nút ≥ 44px', async ({ page }) => {
  // màn đăng nhập
  await page.goto('/');
  await mark(page);
  await drag(page, 200, 120, 760);
  expect(await marked(page), 'màn đăng nhập bị tải lại').toBe(true);
  expect(await pageButtonsSmall(page)).toEqual([]);
  await register(page);
  // màn chơi
  await mark(page);
  await drag(page, 200, 90, 760); // kéo từ đầu trang (thanh trên cùng)
  expect(await marked(page), 'màn chơi bị tải lại').toBe(true);
  expect(await pageButtonsSmall(page)).toEqual([]);
  // chạm đúp không phóng to
  await page.touchscreen.tap(200, 40);
  await page.touchscreen.tap(200, 40);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
  // bảng dài: chợ tab mua, cuộn hết rồi kéo tiếp
  await openTile(page, 9, 2);
  await page.getByTestId('tab-buy').click();
  const box = (await page.locator('[role=dialog]').boundingBox())!;
  for (let i = 0; i < 4; i++) await drag(page, box.x + box.width / 2, box.y + box.height - 60, box.y + 120);
  for (let i = 0; i < 2; i++) await drag(page, box.x + box.width / 2, box.y + 140, box.y + box.height - 40);
  expect(await marked(page), 'kéo trong bảng làm tải lại trang').toBe(true);
  await closeSheet(page);
  // trang không cuộn: fixture kiểm scrollTop === 0 sau test
});

test('AC-11.2 (phần tự động) manifest toàn màn hình, màn dọc, đủ biểu tượng 192/512/maskable; viewport đúng chuẩn', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel=manifest]').getAttribute('href');
  const m = await (await request.get(href!)).json();
  expect(['standalone', 'fullscreen']).toContain(m.display);
  expect(m.orientation).toMatch(/^portrait/);
  const sizes = m.icons.map((i: { sizes: string; purpose?: string }) => `${i.sizes}${i.purpose?.includes('maskable') ? ' maskable' : ''}`);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512', '512x512 maskable']));
  for (const i of m.icons) expect((await request.get(i.src)).status(), i.src).toBe(200);
  const vp = await page.locator('meta[name=viewport]').getAttribute('content');
  expect(vp).toContain('viewport-fit=cover');
  expect(vp).not.toContain('user-scalable=no');
  expect(await page.evaluate(() => getComputedStyle(document.body).overscrollBehaviorY)).toBe('none');
});
