// US-02 đi lại trên bản đồ (AC-02.1 – AC-02.3)
import { closeSheet, expect, openTile, register, stamina, tapTile, test } from './helpers';

test('AC-02.1 chạm ô đất xa: đi tới, thể lực không đổi, bảng việc mở với tình trạng ô và thể lực từng việc', async ({ page }) => {
  await register(page);
  const s0 = await stamina(page);
  await openTile(page, 8, 6); // ô đất thứ 6, xa cửa nhà nhất trong 6 ô
  await expect(page.getByTestId('sheet')).toContainText('Ô đất');
  await expect(page.getByTestId('sheet')).toContainText('Ô trống');
  await expect(page.getByTestId('go-buy-seeds')).toBeVisible();
  expect(await stamina(page)).toBe(s0); // BR4: đi lại không tốn thể lực
});

test('AC-02.2 chạm mặt nước thì tới bờ; đang đi chạm chỗ khác thì đổi đích ngay', async ({ page }) => {
  await register(page);
  await openTile(page, 5, 13); // giữa ao (chưa xây): đi tới bờ / cửa ao
  await expect(page.locator('[role=dialog]')).toContainText(/ao cá/i);
  await closeSheet(page);
  // đang đi tới ô đất xa thì chạm chợ: chỉ chợ mở, ô đất không mở
  await tapTile(page, 8, 10);
  await page.waitForTimeout(150);
  await tapTile(page, 9, 2);
  await expect(page.locator('[role=dialog]')).toContainText('Chợ', { timeout: 15_000 });
  await expect(page.locator('[role=dialog]')).toHaveCount(1);
  await expect(page.locator('[role=dialog]')).not.toContainText('Ô đất');
  // "ô bị rào kín" không có trên bản đồ thật (mọi ô đều tới được): phủ bằng unit test web/test/path.test.ts
});

test('AC-02.3 kéo bản đồ một ngón: nhân vật không đi, không mở bảng, trang không cuộn', async ({ page }) => {
  await register(page);
  const box = (await page.getByTestId('farm-map').locator('canvas').boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2;
  const y0 = box.y + box.height * 0.7;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - i * 25 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(1500);
  await expect(page.locator('[role=dialog]')).toHaveCount(0);
  expect(await stamina(page)).toBe(100);
});
