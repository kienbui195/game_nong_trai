// US-03 thể lực + US-04 trồng trọt, phần người chơi nhìn thấy (AC-01.2 giờ máy, AC-03.1–03.3, AC-04.1, 04.4, 04.6)
import { SLEEP_MS_PER_POINT, STAMINA_COST } from '../../core/src/config';
import { H, MIN, advance, buy, closeSheet, coins, expect, grant, openHouse, openTile, register, reopen, stamina, test } from './helpers';

test('AC-04.1 + AC-03.1 gieo, tưới, 3 giờ, thu: kho +1, thể lực trừ đúng bảng; mua và đi không trừ', async ({ page }) => {
  await register(page);
  await buy(page, 'seed:rau_cai');
  expect(await stamina(page)).toBe(100); // mua + đi tới chợ không trừ
  await openTile(page, 3, 6);
  await page.getByTestId('plant-rau_cai').click();
  await expect.poll(() => stamina(page)).toBe(100 - STAMINA_COST.plant);
  await page.getByTestId('water').click();
  await expect(page.getByTestId('sheet')).toContainText('Đủ nước tới');
  await expect.poll(() => stamina(page)).toBe(100 - STAMINA_COST.plant - STAMINA_COST.water);
  await closeSheet(page);
  await advance(3 * H + 10 * MIN);
  await reopen(page);
  await openTile(page, 3, 6);
  await page.getByTestId('harvest').click();
  await expect(page.getByText('Đã thu hoạch!')).toBeVisible();
  await expect.poll(() => stamina(page)).toBe(100 - STAMINA_COST.plant - STAMINA_COST.water - STAMINA_COST.harvest);
  await expect(page.getByTestId('sheet')).toContainText('Ô trống');
  await closeSheet(page);
  await openTile(page, 9, 2);
  await page.getByTestId('tab-sell').click();
  await expect(page.getByTestId('sell-row-crop:rau_cai').or(page.getByTestId('sell-row-crop:rau_cai-hq')).first()).toBeVisible();
});

test('AC-03.2 ngủ thì hồi +1 mỗi 36 giây, dậy thì giữ số đã hồi; AC-03.4 đang thức không tự hồi', async ({ page }) => {
  await register(page);
  await buy(page, 'seed:rau_cai');
  await openTile(page, 3, 6);
  await page.getByTestId('plant-rau_cai').click();
  await page.getByTestId('water').click();
  await expect(page.getByTestId('sheet')).toContainText('Đủ nước tới');
  await closeSheet(page);
  const s0 = await stamina(page);
  await advance(2 * H);
  await reopen(page);
  expect(await stamina(page)).toBe(s0); // AC-03.4
  await openHouse(page);
  await page.getByTestId('sleep').click();
  await expect(page.getByTestId('wake')).toBeVisible();
  await closeSheet(page);
  await advance(2 * SLEEP_MS_PER_POINT + 1000);
  await reopen(page);
  expect(await stamina(page)).toBe(s0 + 2);
  await openHouse(page);
  await page.getByTestId('wake').click();
  await expect(page.getByTestId('sleep')).toBeVisible();
  await closeSheet(page);
  await advance(10 * MIN);
  await reopen(page);
  expect(await stamina(page)).toBe(s0 + 2);
});

test('AC-03.3 hết thể lực: báo thiếu thể lực, không đổi gì', async ({ page }) => {
  const u = await register(page);
  await grant(page, u.username, { item: 'seed:rau_cai', n: 1 });
  await openTile(page, 3, 6);
  await page.getByTestId('plant-rau_cai').click();
  await expect(page.getByTestId('water')).toBeVisible();
  let s = await stamina(page);
  while (s > 0) {
    await page.getByTestId('water').click();
    await expect.poll(() => stamina(page)).toBe(s - STAMINA_COST.water);
    s -= STAMINA_COST.water;
  }
  const xu = await coins(page);
  await page.getByTestId('water').click();
  await expect(page.getByText(/Thiếu \d+ thể lực/)).toBeVisible();
  expect(await stamina(page)).toBe(0);
  expect(await coins(page)).toBe(xu);
});

test('AC-04.4 cây ăn quả sang mùa khác thì "ngủ"', async ({ page }) => {
  const u = await register(page);
  await grant(page, u.username, { item: 'seed:dau_tay', n: 1 });
  await openTile(page, 3, 6);
  await page.getByTestId('plant-dau_tay').click();
  await page.getByTestId('water').click();
  await expect(page.getByTestId('sheet')).toContainText('Đủ nước tới');
  await closeSheet(page);
  await advance(7 * 24 * H);
  await reopen(page);
  await expect(page.getByTestId('hud-season')).toContainText('Hạ');
  await openTile(page, 3, 6);
  await expect(page.getByTestId('plot-stage')).toContainText('Ngoài mùa — cây đang ngủ');
});

test('AC-04.6 gieo muộn: hỏi xác nhận, đồng ý thì gieo', async ({ page }) => {
  const u = await register(page);
  await advance(7 * 24 * H - 2 * H); // còn 2 giờ là hết Xuân; rau cải cần 3 giờ
  await reopen(page);
  await grant(page, u.username, { item: 'seed:rau_cai', n: 1 });
  await openTile(page, 3, 6);
  await page.getByTestId('plant-rau_cai').click();
  await expect(page.getByRole('dialog', { name: 'Không kịp chín' })).toBeVisible();
  await page.getByTestId('confirm-yes').click();
  await expect(page.getByTestId('plot-stage')).toContainText('Đang lớn');
});

test('AC-01.2 chỉnh giờ điện thoại không đổi kết quả: cây lớn theo giờ server', async ({ page }) => {
  await page.clock.install({ time: new Date(Date.now() + 5 * 24 * H) }); // giờ máy chạy trước 5 ngày
  await register(page);
  await buy(page, 'seed:rau_cai');
  await openTile(page, 3, 6);
  await page.getByTestId('plant-rau_cai').click();
  await page.getByTestId('water').click();
  await expect(page.getByTestId('sheet')).toContainText('Đủ nước tới');
  await closeSheet(page);
  await reopen(page);
  await openTile(page, 3, 6);
  await expect(page.getByTestId('plot-stage')).toContainText('Đang lớn'); // không chín dù giờ máy đã qua 5 ngày
  await expect(page.getByTestId('hud-season')).toContainText('ngày 1/');
});
