// US-09 việc làm thêm — phần người chơi nhìn thấy (AC-09.1 – AC-09.8)
import type { Page } from '@playwright/test';
import { seedQuestions } from './global-setup';
import { closeSheet, coins, e2e, expect, expectTapTargets, openHouse, register, reopen, stamina, test, advance } from './helpers';

const view = (page: Page) =>
  page.evaluate(async () => {
    const r = await fetch('/api/farm', { headers: { authorization: 'Bearer ' + localStorage.getItem('nongtrai_token') } });
    return (await r.json()).view;
  });
async function openComputer(page: Page) {
  await openHouse(page);
  await page.getByTestId('open-computer').click();
  await expect(page.getByRole('dialog', { name: /Việc làm thêm/ })).toBeVisible();
}
const right = (page: Page) => page.locator('[data-testid^=job-option-]', { hasText: 'Đúng' });
const wrong = (page: Page) => page.locator('[data-testid^=job-option-]', { hasText: 'Sai' }).first();
async function answerRight(page: Page, k: number) {
  await expect(page.getByTestId('job-active')).toContainText(`Câu ${k}/10`);
  await right(page).click();
}

test('AC-09.1 + AC-09.8 đúng 10/10 thì được thưởng, thể lực không đổi, hai việc kia giữ nguyên; máy không bao giờ nhận đáp án', async ({ page }) => {
  const bodies: string[] = [];
  page.on('response', async (r) => {
    if (r.url().includes('/api/')) bodies.push(await r.text().catch(() => ''));
  });
  await register(page);
  await openComputer(page);
  await expectTapTargets(page);
  const v = await view(page);
  const [o, ...rest] = v.job.offers;
  const xu = await coins(page);
  const s0 = await stamina(page);
  await page.getByTestId('job-accept').first().click();
  for (let k = 1; k <= 10; k++) await answerRight(page, k);
  await expect.poll(() => coins(page)).toBe(xu - o.fee + o.reward);
  expect(await stamina(page)).toBe(s0);
  await expect(page.getByTestId('job-offer')).toHaveCount(2);
  const after = await view(page);
  expect(after.job.offers.map((x: { id: number }) => x.id)).toEqual(rest.map((x: { id: number }) => x.id));
  expect(bodies.length).toBeGreaterThan(10);
  for (const b of bodies) expect(b, 'phản hồi chứa đáp án').not.toMatch(/"correct"|"questions"|"seed"/);
});

test('AC-09.2 sai câu 7: thất bại ngay, mất phí, hiện đáp án đúng', async ({ page }) => {
  await register(page);
  await openComputer(page);
  const o = (await view(page)).job.offers[0];
  const xu = await coins(page);
  await page.getByTestId('job-accept').first().click();
  for (let k = 1; k <= 6; k++) await answerRight(page, k);
  await expect(page.getByTestId('job-active')).toContainText('Câu 7/10');
  await wrong(page).click();
  await expect(page.getByTestId('job-failed')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText(/Đáp án đúng: Đúng/);
  expect(await coins(page)).toBe(xu - o.fee);
});

test('AC-09.3 đồng hồ 20 giây theo giờ server: quá hạn thì trả lời đúng cũng thất bại', async ({ page }) => {
  await register(page);
  await openComputer(page);
  await page.getByTestId('job-accept').first().click();
  await expect(page.getByTestId('job-timer')).toContainText(/(19|20)s/);
  await advance(21_000);
  await right(page).click();
  await expect(page.getByTestId('job-failed')).toBeVisible();
});

test('AC-09.4 đóng mở máy tính giữ nguyên danh sách; đổi danh sách 15 rồi 30 xu', async ({ page }) => {
  await register(page);
  await openComputer(page);
  const ids0 = (await view(page)).job.offers.map((x: { id: number }) => x.id);
  await closeSheet(page);
  await openComputer(page);
  expect((await view(page)).job.offers.map((x: { id: number }) => x.id)).toEqual(ids0);
  await expect(page.getByTestId('job-reroll')).toContainText('15');
  const xu = await coins(page);
  await page.getByTestId('job-reroll').click();
  await expect(page.getByTestId('job-reroll')).toContainText('30');
  expect(await coins(page)).toBe(xu - 15);
  expect((await view(page)).job.offers.map((x: { id: number }) => x.id)).not.toEqual(ids0);
});

test('AC-09.6 tắt app giữa chừng: mở lại sau khi hết giờ thấy việc thất bại', async ({ page }) => {
  await register(page);
  await openComputer(page);
  await page.getByTestId('job-accept').first().click();
  await answerRight(page, 1);
  await expect(page.getByTestId('job-active')).toContainText('Câu 2/10');
  await advance(25_000);
  await reopen(page);
  await openComputer(page);
  await expect(page.getByTestId('job-failed')).toBeVisible();
  await expect(page.getByTestId('job-active')).toHaveCount(0);
});

test('AC-09.7 ngân hàng câu hỏi rỗng: báo chưa có việc; nhập đủ câu thì có việc', async ({ page }) => {
  await e2e('/__e2e/reset?questions');
  try {
    await register(page);
    await openComputer(page);
    await expect(page.getByRole('dialog')).toContainText('Chưa có việc');
    await expect(page.getByTestId('job-offer')).toHaveCount(0);
  } finally {
    await seedQuestions(); // nạp lại câu hỏi (không xoá người chơi) cho phần sau và các test sau
  }
  await closeSheet(page);
  await reopen(page);
  await openComputer(page);
  await expect(page.getByTestId('job-offer')).toHaveCount(3);
});
