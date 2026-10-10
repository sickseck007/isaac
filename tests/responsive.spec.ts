import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

test.use({ hasTouch: true, isMobile: true });

async function fits(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  for (const dialog of await page.getByRole('dialog').all()) {
    expect(await dialog.evaluate(el => el.scrollWidth - el.clientWidth), 'Dialog content should fit its width').toBeLessThanOrEqual(1);
    const bounds = (await dialog.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
  }
}

async function seedClassic(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('isaac-guess-club:dle:v1', JSON.stringify({
      version: 1, mode: 'classic',
      rounds: { classic: { targetId: 182, guesses: [], revealed: false, hints: 0, rotation: 90 } },
    }));
  });
}

for (const width of [320, 390, 430, 640]) {
  test(`phone controls, classic comparisons, and every page fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await seedClassic(page);
    await page.goto('/#dle');
    const answer = page.getByRole('combobox', { name: 'Ваш ответ — предмет' });
    await expect(answer).toBeVisible();
    expect(await answer.evaluate(el => getComputedStyle(el).fontSize)).toBe('16px');
    const lost = page.getByRole('combobox', { name: 'Что сравнивать для Лоста' });
    expect(await lost.evaluate(el => getComputedStyle(el).fontSize)).toBe('16px');
    for (const button of await page.locator('.main-nav button').all()) {
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await answer.fill('The Sad Onion');
    await page.getByRole('option', { name: 'Ответ: The Sad Onion', exact: true }).tap();
    const row = page.getByRole('row').last();
    await expect(row.getByRole('cell')).toHaveCount(8);
    const cells = await row.getByRole('cell').all();
    const first = (await cells[0].boundingBox())!;
    const second = (await cells[1].boundingBox())!;
    const third = (await cells[2].boundingBox())!;
    expect(Math.abs(first.y - second.y)).toBeLessThan(1);
    expect(second.x).toBeGreaterThan(first.x);
    expect(third.y).toBeGreaterThan(first.y);
    expect(await cells[2].evaluate(el => getComputedStyle(el, '::before').content)).toBe('"Добавлен в"');
    await fits(page);
    for (const mode of ['Эффект', 'Иконка', 'Эмодзи', 'Классика']) {
      await page.getByRole('button', { name: new RegExp(`^${mode}`) }).tap();
      await expect(answer).toBeVisible();
      await fits(page);
    }
    for (const name of ['Игровое поле', 'Рулетка', 'Справочник']) {
      await page.getByRole('button', { name, exact: true }).tap();
      await fits(page);
    }
    await page.getByRole('textbox', { name: 'Поиск в справочнике' }).fill('Godhead');
    await page.getByRole('button', { name: 'Справочник: Godhead', exact: true }).tap();
    await expect(page.locator('.item-detail-sections')).toBeVisible();
    await fits(page);
  });
}

test('touch controls preserve independent boards and nested dialogs fit a short phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/#board');
  const fields = page.locator('.boards-overview .board-panel');
  await expect(fields).toHaveCount(3);
  const first = fields.nth(0), second = fields.nth(1);
  const card = first.locator('.item-card').first();
  const id = await card.getAttribute('data-item-id');
  await card.tap();
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  await expect(second.locator(`[data-item-id="${id}"]`)).toHaveAttribute('aria-pressed', 'false');
  await fits(page);
  await page.getByRole('button', { name: 'Настроить игроков', exact: true }).tap();
  await fits(page);
  await page.getByRole('textbox', { name: 'Имя игрока 1', exact: true }).fill('Друг');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).tap();
  await expect(first).toHaveAttribute('aria-label', 'Игровое поле Друг');
  await page.getByRole('button', { name: /Набор предметов/ }).tap();
  const builder = page.getByRole('dialog', { name: 'Соберите свой набор' });
  await builder.getByRole('button', { name: /Оформление и код поля/ }).tap();
  await fits(page);
  await builder.getByRole('textbox', { name: 'Поиск в каталоге' }).fill('Godhead');
  await builder.getByRole('button', { name: 'Описание Godhead', exact: true }).tap();
  await expect(page.getByRole('dialog')).toHaveCount(2);
  await expect(page.locator('.item-detail-sections')).toBeVisible();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Увеличить масштаб описания' }).tap();
  await expect(page.getByLabel('Текущий масштаб')).toHaveText('200%');
  await fits(page);
  // The close button remains reachable after scrolling a long description.
  await page.getByRole('dialog').last().evaluate(el => { el.scrollTop = el.scrollHeight; });
  const close = page.getByRole('dialog').last().getByRole('button', { name: 'Закрыть окно' });
  const bounds = (await close.boundingBox())!;
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(568);
  await close.tap();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await builder.getByRole('button', { name: 'Закрыть окно' }).tap();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(card).toHaveAttribute('aria-pressed', 'true');
});

test('landscape keeps wide comparisons scrollable within the page', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await seedClassic(page);
  await page.goto('/#dle');
  await expect(page.getByRole('combobox', { name: 'Ваш ответ — предмет' })).toBeVisible();
  expect(await page.getByRole('combobox', { name: 'Ваш ответ — предмет' }).evaluate(el => getComputedStyle(el).fontSize)).toBe('16px');
  await page.getByRole('combobox', { name: 'Ваш ответ — предмет' }).fill('The Sad Onion');
  await page.getByRole('option', { name: 'Ответ: The Sad Onion', exact: true }).tap();
  await fits(page);
  const scroll = page.getByRole('region', { name: 'Сравнение попыток' });
  await scroll.scrollIntoViewIfNeeded();
  expect(await scroll.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  await scroll.evaluate(el => { el.scrollLeft = el.scrollWidth; });
  await expect(page.locator('[data-category="lost"]')).toBeInViewport();
  await fits(page);
});
