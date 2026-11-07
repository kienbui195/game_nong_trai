// US-07 chợ + US-08 mở rộng — phần người chơi nhìn thấy (AC-07.1, 07.3, 07.4, 07.5, 08.2)
import type { Page } from '@playwright/test';
import { H, advance, closeSheet, coins, expect, expectTapTargets, grant, openTile, register, test } from './helpers';

const priceIn = async (page: Page, itemId: string) => {
  const t = await page.getByTestId(`sell-row-${itemId}`).textContent();
  return Number(t!.match(/(\d+) xu\/cái/)![1]);
};
const serverPrice = (page: Page, itemId: string) =>
  page.evaluate(async (id) => {
    const r = await fetch('/api/farm', { headers: { authorization: 'Bearer ' + localStorage.getItem('nongtrai_token') } });
    return (await r.json()).view.market.find((m: { itemId: string }) => m.itemId === id).price as number;
  }, itemId);

test('AC-07.1 + AC-07.3 bán bí ngô: mỗi cái bán ra giá giảm ~1%, có mũi tên xu hướng; nút đủ lớn', async ({ page }) => {
  const u = await register(page);
  await grant(page, u.username, { item: 'crop:bi_ngo', n: 10 });
  await openTile(page, 9, 2);
  await page.getByTestId('tab-sell').click();
  const row = page.getByTestId('sell-row-crop:bi_ngo');
  await expect(row).toContainText(/[▲▼▬]/);
  await expect(row).toContainText('có 10');
  const p0 = await priceIn(page, 'crop:bi_ngo');
  const xu = await coins(page);
  await row.getByTestId('sell-1').click();
  await expect(row).toContainText('có 9');
  expect(await coins(page)).toBe(xu + p0);
  const p1 = await priceIn(page, 'crop:bi_ngo');
  expect(p1).toBeLessThan(p0);
  expect(p1).toBeGreaterThanOrEqual(Math.floor(p0 * 0.98));
  await expectTapTargets(page);
  await page.getByTestId('tab-buy').click();
  await expectTapTargets(page);
});

test('AC-07.4 có đúng 40 xu thì mua được phân tốt 40; có 39 thì nút mua bị khoá', async ({ page }) => {
  const u = await register(page);
  await grant(page, u.username, { coins: 39 });
  await openTile(page, 9, 2);
  await page.getByTestId('tab-buy').click();
  await expect(page.locator('[data-testid="buy-row-fert:good"] [data-testid=buy]')).toBeDisabled();
  await closeSheet(page);
  await grant(page, u.username, { coins: 40 });
  await openTile(page, 9, 2);
  await page.getByTestId('tab-buy').click();
  await page.locator('[data-testid="buy-row-fert:good"] [data-testid=buy]').click();
  await expect.poll(() => coins(page)).toBe(0);
});

test('AC-07.5 giá đổi trong lúc đang mở chợ: hỏi giá mới, đồng ý thì bán theo giá mới', async ({ page }) => {
  const u = await register(page);
  await grant(page, u.username, { item: 'crop:bi_ngo', n: 3 });
  await openTile(page, 9, 2);
  await page.getByTestId('tab-sell').click();
  const shown = await priceIn(page, 'crop:bi_ngo');
  let now = shown;
  for (let k = 0; k < 8 && now === shown; k++) {
    await advance(4 * H); // sang kỳ giá mới, màn hình chưa tải lại
    now = await serverPrice(page, 'crop:bi_ngo');
  }
  expect(now).not.toBe(shown);
  const xu = await coins(page);
  await page.getByTestId('sell-row-crop:bi_ngo').getByTestId('sell-1').click();
  await expect(page.getByRole('dialog', { name: 'Giá vừa đổi' })).toContainText(`${now} xu`);
  await page.getByTestId('confirm-yes').click();
  await expect.poll(() => coins(page)).toBe(xu + now);
});

test('AC-08.2 mở rộng đất tới 30 ô thì dừng', async ({ page }) => {
  const u = await register(page);
  await grant(page, u.username, { coins: 200_000 });
  await page.getByTestId('open-expand').click();
  for (let i = 0; i < 8; i++) {
    await page.getByTestId('expand-plots').click();
    await expect(page.getByText(/Có thêm 3 ô đất!/).first()).toBeVisible();
    await expect.poll(() => page.locator('[role=dialog]').textContent()).toContain(`${9 + i * 3}`);
  }
  await expect(page.locator('[role=dialog]')).toContainText('30');
  await expect(page.locator('[data-testid=expand-plots]:enabled')).toHaveCount(0);
  await expectTapTargets(page);
});
