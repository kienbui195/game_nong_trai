// US-05 chăn nuôi, US-06 ao cá — phần người chơi nhìn thấy (AC-05.1, 05.5, 05.6, 06.2)
import { H, advance, closeSheet, expect, expectTapTargets, grant, openTile, register, reopen, test } from './helpers';

const COOP = [1, 13] as const;
const POND = [5, 13] as const;

async function build(page: import('@playwright/test').Page, at: readonly [number, number], type: 'coop' | 'pond') {
  await openTile(page, at[0], at[1]);
  await page.getByTestId(`build-${type}`).click();
  await expect(page.getByText(/Đã xây/)).toBeVisible();
  await closeSheet(page);
  await openTile(page, at[0], at[1]);
}

test('AC-05.1 + AC-05.5 xây chuồng, mua gà, cho ăn: 24 giờ trưởng thành, 24 giờ nữa thu trứng; vuốt ve một lần mỗi ngày', async ({ page }) => {
  const u = await register(page);
  await grant(page, u.username, { coins: 2000, item: 'feed:poultry', n: 3 });
  await build(page, COOP, 'coop');
  await page.getByTestId('buy-ga').click();
  await expect(page.getByTestId('animal-card')).toHaveCount(1);
  await expectTapTargets(page);
  await page.getByTestId('feed').click();
  await expect(page.getByTestId('animal-card')).toContainText(/No tới/);
  // AC-05.5: vuốt ve lần hai trong ngày không được
  await page.getByTestId('pet').click();
  await expect(page.getByTestId('pet')).toBeDisabled();
  await closeSheet(page);
  await advance(24 * H);
  await reopen(page);
  await openTile(page, ...COOP);
  await page.getByTestId('feed').click();
  await expect(page.getByTestId('collect')).toHaveCount(0);
  await closeSheet(page);
  await advance(24 * H + 10 * 60_000);
  await reopen(page);
  await openTile(page, ...COOP);
  await page.getByTestId('collect').click();
  await expect(page.getByText('Đã thu!')).toBeVisible();
  await expect(page.getByTestId('pet')).toBeEnabled(); // ngày mới vuốt ve lại được
});

test('AC-05.6 chuồng đầy 6/6 thì không còn nút mua', async ({ page }) => {
  const u = await register(page);
  await grant(page, u.username, { coins: 5000 });
  await build(page, COOP, 'coop');
  for (let i = 1; i <= 6; i++) {
    await page.getByTestId('buy-ga').click();
    await expect(page.getByTestId('animal-card')).toHaveCount(i);
  }
  // đầy 6/6: giao diện không cho mua nữa (server cũng từ chối "Chuồng đầy rồi." — test server/core)
  await expect(page.getByTestId('buy-ga')).toHaveCount(0);
  await expect(page.getByTestId('animal-card')).toHaveCount(6);
});

test('AC-06.2 ao: cá chưa lớn không có nút bán; ao đầy 10/10 thì không thả thêm', async ({ page }) => {
  const u = await register(page);
  await grant(page, u.username, { coins: 5000 });
  await build(page, POND, 'pond');
  await page.getByTestId('buy-fish-toggle').click();
  for (let i = 0; i < 10; i++) {
    if (i > 0 && !(await page.getByTestId('buy-fish-ro_phi').isVisible())) await page.getByTestId('buy-fish-toggle').click();
    await page.getByTestId('buy-fish-ro_phi').click();
    await expect(page.getByText(/· 0%/)).toHaveCount(i + 1);
  }
  await expect(page.getByTestId('sell-fish')).toHaveCount(0); // cá chưa lớn: không có nút bán
  await expect(page.getByTestId('buy-fish-toggle')).toHaveCount(0); // ao đầy 10/10: không thả thêm được
  await expectTapTargets(page);
});
