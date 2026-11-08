// Màn ngang (desktop): bản đồ vẽ 22×12 vừa trọn khung, bảng việc mở từ bên phải, HUD một dòng.
import { PLOT_SLOTS } from '../../core/src/map';
import { closeSheet, expect, openHouse, openTile, register, test, tilePoint } from './helpers';

test.use({ viewport: { width: 1440, height: 860 }, isMobile: false, deviceScaleFactor: 1 });

test('màn ngang: bản đồ vừa khung không cuộn, chạm ô đúng chỗ, bảng việc mở bên phải', async ({ page }) => {
  await register(page);
  // cả bản đồ nằm trong khung: góc ô cuối cùng (11, 21) vẫn ở trong canvas, ô đủ lớn để chạm
  const canvas = (await page.getByTestId('farm-map').locator('canvas').boundingBox())!;
  const last = await tilePoint(page, 11, 21);
  expect(last.tile).toBeGreaterThanOrEqual(44);
  expect(last.x + last.tile / 2).toBeLessThanOrEqual(canvas.x + canvas.width + 1);
  expect(last.y + last.tile / 2).toBeLessThanOrEqual(canvas.y + canvas.height + 1);
  // HUD một dòng: thanh trên cùng thấp
  expect((await page.locator('header').boundingBox())!.height).toBeLessThan(70);

  await openHouse(page);
  await expect(page.getByTestId('sheet')).toHaveAttribute('data-vaul-drawer-direction', 'right');
  await closeSheet(page);

  await openTile(page, PLOT_SLOTS[0].x, PLOT_SLOTS[0].y);
  await expect(page.getByTestId('sheet')).toContainText('Ô đất');
  await closeSheet(page);

  await openTile(page, 9, 2); // chợ
  await expect(page.getByRole('dialog')).toContainText('Chợ');
  await closeSheet(page);
});
