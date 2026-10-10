import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const test = base.extend<{ browserHealth: void }>({
  browserHealth: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
    await use();
    expect(errors).toEqual([]);
  }, { auto: true }],
});

async function openDle(page: Page) {
  await page.addInitScript(() => {
    const key = 'isaac-guess-club:dle:v1';
    if (localStorage.getItem(key)) return;
    const round = (targetId: number) => ({ targetId, guesses: [], revealed: false, hints: 0, rotation: 180 });
    const stats = () => ({ solved: 0, skipped: 0, points: 0 });
    localStorage.setItem(key, JSON.stringify({
      version: 1, mode: 'classic', lostRule: 'tainted',
      rounds: { classic: round(182), effects: round(118), icon: round(105), emoji: round(3) },
      stats: { classic: stats(), effects: stats(), icon: stats(), emoji: stats() },
      iconSettings: { grayscale: true, rotate: true },
    }));
  });
  await page.goto('/#dle');
  await expect(page.getByRole('heading', { name: 'Один предмет. Сколько догадок?' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Ваш ответ — предмет' })).toBeVisible();
}

async function guess(page: Page, name: string) {
  await page.getByRole('combobox', { name: 'Ваш ответ — предмет' }).fill(name);
  await page.getByRole('option', { name: `Ответ: ${name}`, exact: true }).click();
}

test('classic compares stats, Lost rules and quality, persists progress, and awards one win', async ({ page }) => {
  await openDle(page);
  await expect(page.locator('.dle-table th[scope="col"]')).toHaveCount(9);
  await guess(page, 'The Sad Onion');
  const row = page.locator('.dle-table tbody tr').first();
  await expect(row.locator('[data-category="type"]')).toHaveAttribute('data-match', 'exact');
  await expect(row.locator('[data-category="quality"]')).toHaveAttribute('data-match', 'wrong');
  await expect(row.getByLabel('Качество выше', { exact: true })).toBeVisible();
  await expect(row.locator('[data-category="stats"]')).toHaveAttribute('data-match', 'partial');
  await expect(row.locator('[data-category="pools"]')).toHaveAttribute('data-match', 'wrong');
  await page.getByRole('combobox', { name: 'Что сравнивать для Лоста' }).selectOption('unlock');
  await guess(page, 'Godhead');
  await expect(row.locator('[data-category="lost"]')).toHaveAttribute('data-match', 'wrong');
  await expect(row.locator('[data-category="pools"]')).toHaveAttribute('data-match', 'partial');
  await page.reload();
  await expect(page.locator('.dle-table tbody tr')).toHaveCount(2);
  await expect(page.getByRole('combobox', { name: 'Что сравнивать для Лоста' })).toHaveValue('unlock');
  await page.getByRole('combobox', { name: 'Ваш ответ — предмет' }).fill('Godhead');
  await expect(page.getByRole('option', { name: 'Ответ: Godhead', exact: true })).toHaveCount(0);
  await guess(page, 'Sacred Heart');
  await expect(page.locator('.dle-result')).toContainText('Угадано за 3 попытки · +96 очков');
  await expect(page.locator('.dle-winning-row [data-match="exact"]')).toHaveCount(8);
  await expect(page.getByRole('combobox', { name: 'Ваш ответ — предмет' })).toHaveCount(0);
  await page.locator('.dle-result').getByRole('button', { name: 'Описание', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Священное Сердце' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('.dle-result')).toContainText('Sacred Heart');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('isaac-guess-club:dle:v1')!).stats.classic)).toEqual({ solved: 1, skipped: 0, points: 96 });
  await page.getByRole('button', { name: 'Ещё загадка' }).click();
  await expect(page.locator('.dle-table tbody tr')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('isaac-guess-club:dle:v1')!).rounds.classic.targetId)).not.toBe(182);
});

test('effect and emoji puzzles hide the answer, reveal hints, and maintain independent rounds', async ({ page }) => {
  await openDle(page);
  await page.getByRole('button', { name: /^Эффект/ }).click();
  await expect(page.locator('.dle-effect-clue')).toContainText('кровавым лучом');
  await expect(page.locator('.dle-effect-clue a,.dle-effect-clue img')).toHaveCount(0);
  await expect(page.locator('.dle-page')).not.toContainText('Brimstone');
  await page.getByRole('button', { name: /Открыть подсказку/ }).click();
  await expect(page.getByText('Тип: Пассивный', { exact: true })).toBeVisible();
  await guess(page, 'The Sad Onion');
  await page.getByRole('button', { name: /^Эмодзи/ }).click();
  await expect(page.locator('.dle-emoji-clue>span')).toHaveText(['🥄', '?', '?']);
  await guess(page, 'The Sad Onion');
  await expect(page.locator('.dle-emoji-clue>span')).toHaveText(['🥄', '🌀', '?']);
  await expect(page.locator('.dle-round-meta')).toContainText('За победу: 100');
  await page.reload();
  await expect(page.locator('.dle-emoji-clue>span')).toHaveText(['🥄', '🌀', '?']);
  await guess(page, 'The Inner Eye');
  await expect(page.locator('.dle-emoji-clue>span')).toHaveText(['🥄', '🌀', '🎯']);
  await expect(page.locator('.dle-round-meta')).toContainText('За победу: 96');
  await expect(page.locator('.dle-page')).not.toContainText('Spoon Bender');
  await page.getByRole('combobox', { name: 'Ваш ответ — предмет' }).fill('сгибатель ложек');
  await page.getByRole('combobox', { name: 'Ваш ответ — предмет' }).press('Enter');
  await expect(page.locator('.dle-result')).toContainText('Spoon Bender');
  await page.getByRole('button', { name: /^Эффект/ }).click();
  await expect(page.locator('.dle-guess-history>div')).toHaveCount(1);
  await expect(page.getByText('Тип: Пассивный', { exact: true })).toBeVisible();
  await guess(page, 'Brimstone');
  await expect(page.locator('.dle-result')).toContainText('+90 очков');
  await page.reload();
  await expect(page.locator('.dle-result')).toContainText('Brimstone');
  expect(await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('isaac-guess-club:dle:v1')!); return [s.stats.effects.solved, s.stats.emoji.solved, s.stats.classic.solved]; })).toEqual([1, 1, 0]);
});

test('icon grayscale and rotation can be disabled, persist, and ease after errors', async ({ page }) => {
  await openDle(page);
  await page.getByRole('button', { name: /^Иконка/ }).click();
  const image = page.locator('.dle-mystery-icon img');
  await expect(image).toHaveAttribute('alt', 'Загаданный предмет');
  await expect.poll(() => image.evaluate(el => getComputedStyle(el).filter)).toBe('grayscale(1)');
  await expect.poll(() => image.evaluate(el => getComputedStyle(el).transform)).not.toBe('matrix(1, 0, 0, 1, 0, 0)');
  await page.getByRole('checkbox', { name: 'Чёрно-белый вид' }).uncheck();
  await page.getByRole('checkbox', { name: 'Поворот' }).uncheck();
  await expect.poll(() => image.evaluate(el => getComputedStyle(el).filter)).toBe('grayscale(0)');
  await expect.poll(() => image.evaluate(el => getComputedStyle(el).transform)).toBe('matrix(1, 0, 0, 1, 0, 0)');
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Чёрно-белый вид' })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Поворот' })).not.toBeChecked();
  await page.getByRole('checkbox', { name: 'Чёрно-белый вид' }).check();
  await page.getByRole('checkbox', { name: 'Поворот' }).check();
  await guess(page, 'The Sad Onion');
  await guess(page, 'The Inner Eye');
  await expect(page.getByText('Тип: Активный', { exact: true })).toBeVisible();
  await expect.poll(() => image.evaluate(el => Number(/grayscale\(([^)]+)/.exec(getComputedStyle(el).filter)![1]))).toBeLessThan(1);
  await page.getByRole('button', { name: 'Показать ответ' }).click();
  await expect(page.locator('.dle-result')).toContainText('The D6');
  await expect.poll(() => image.evaluate(el => getComputedStyle(el).filter)).toBe('grayscale(0)');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('isaac-guess-club:dle:v1')!).stats.icon)).toEqual({ solved: 0, skipped: 1, points: 0 });
});

test('all modes fit mobile and tablet, comparison scrolls locally, and friend fields remain intact', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDle(page);
  const board = await page.evaluate(() => JSON.parse(localStorage.getItem('isaac-guess-club:v1')!));
  await guess(page, 'The Sad Onion');
  for (const mode of ['Эффект', 'Иконка', 'Эмодзи', 'Классика']) {
    await page.getByRole('button', { name: new RegExp(`^${mode}`) }).click();
    await expect(page.getByRole('combobox', { name: 'Ваш ответ — предмет' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  }
  expect(await page.locator('.dle-table-scroll').evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  await page.getByRole('button', { name: 'Следующий предмет', exact: true }).click();
  await page.setViewportSize({ width: 640, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(640);
  await page.getByRole('button', { name: 'Игровое поле', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(90);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('isaac-guess-club:v1')!).boardIds)).toEqual(board.boardIds);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('isaac-guess-club:v1')!).players)).toEqual(board.players);
});


test('classic flips new comparisons in sequence, waits for victory, and does not replay saved rows', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openDle(page);
  await expect(page.getByRole('columnheader', { name: 'Добавлен в', exact: true })).toBeVisible();
  // Pause on insertion to inspect the actual CSS timeline deterministically.
  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      if (!document.querySelector('.dle-flipping')) return;
      for (const animation of document.getAnimations()) {
        if (animation instanceof CSSAnimation && animation.animationName.startsWith('dle-flip')) {
          animation.pause(); animation.currentTime = 0;
        }
      }
      observer.disconnect();
    });
    observer.observe(document.querySelector('.dle-page')!, { subtree: true, childList: true, attributes: true });
  });
  await guess(page, 'Sacred Heart');
  const cells = page.locator('.dle-winning-row .dle-cell');
  await expect(cells).toHaveCount(8);
  expect(await cells.evaluateAll(elements => elements.map(el => Number.parseFloat(getComputedStyle(el).animationDelay)))).toEqual([0, .28, .56, .84, 1.12, 1.4, 1.68, 1.96]);
  await expect(page.locator('.dle-result')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Ваш ответ — предмет' })).toHaveAttribute('aria-disabled', 'true');
  const visible = await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      if (animation instanceof CSSAnimation && animation.animationName.startsWith('dle-flip')) animation.currentTime = 700;
    }
    const cells = document.querySelectorAll('.dle-winning-row .dle-cell');
    return [getComputedStyle(cells[0].querySelector('span')!).visibility, getComputedStyle(cells[7].querySelector('span')!).visibility,
      getComputedStyle(cells[0], '::after').opacity, getComputedStyle(cells[7], '::after').opacity];
  });
  expect(visible).toEqual(['visible', 'hidden', '0', '1']);
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      if (animation instanceof CSSAnimation && animation.animationName.startsWith('dle-flip')) { animation.currentTime = 0; animation.play(); }
    }
  });
  await expect(page.locator('.dle-result')).toContainText('+100 очков');
  await expect(page.locator('.dle-flipping')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.dle-result')).toContainText('+100 очков');
  await expect(page.locator('.dle-flipping')).toHaveCount(0);
});
