import { test, expect } from '@playwright/test';

test('English names and forgiving search work across clues, reference, catalogue and player fields', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('isaac-guess-club:dle:v1', JSON.stringify({
    version: 1, mode: 'classic', rounds: { classic: { targetId: 182, guesses: [], revealed: false, hints: 0, rotation: 90 } },
  })));
  await page.goto('/#dle');
  const answer = page.getByRole('combobox', { name: 'Ваш ответ — предмет' });
  await answer.fill('MOMS KNIFE');
  const option = page.getByRole('option', { name: "Ответ: Mom's Knife", exact: true });
  await expect(option.locator('strong')).toHaveText("Mom's Knife");
  await expect(option.locator('small')).toContainText('Мамин Нож');
  await option.click();
  await expect(page.locator('.dle-table tbody th strong')).toHaveText("Mom's Knife");
  await answer.fill('священное сердце');
  await page.getByRole('option', { name: 'Ответ: Sacred Heart', exact: true }).click();
  await expect(page.locator('.dle-result h2')).toHaveText('Sacred Heart');
  await page.getByRole('button', { name: 'Справочник', exact: true }).click();
  await page.getByRole('textbox', { name: 'Поиск в справочнике' }).fill('mom’s knife');
  const entry = page.getByRole('button', { name: "Справочник: Mom's Knife", exact: true });
  await expect(entry.locator('strong')).toHaveText("Mom's Knife");
  await entry.click();
  const details = page.getByRole('dialog', { name: "Mom's Knife", exact: true });
  await expect(details.locator('.item-detail-sections')).toBeVisible();
  await expect(details).toContainText('Эффекты и подробности');
  const linkNames = await details.locator('a[href^="#entry="]').allTextContents();
  expect(linkNames.length).toBeGreaterThan(0);
  expect(linkNames.every(name => !/[а-яё]/i.test(name))).toBe(true);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Игровое поле', exact: true }).click();
  await page.getByRole('button', { name: /Набор предметов/ }).click();
  const builder = page.getByRole('dialog', { name: 'Соберите свой набор' });
  await builder.getByRole('button', { name: 'Снять выбор', exact: true }).click();
  await builder.getByRole('textbox', { name: 'Поиск в каталоге' }).fill('xrayvision');
  await expect(builder.locator('.catalogue-item')).toHaveCount(1);
  await expect(builder.locator('.catalogue-item')).toContainText('X-Ray Vision');
  await builder.getByRole('textbox', { name: 'Поиск в каталоге' }).fill('mom’s knife');
  await expect(builder.locator('.catalogue-item')).toHaveCount(1);
  await builder.getByRole('button', { name: "Добавить Mom's Knife", exact: true }).click();
  await builder.getByRole('button', { name: 'Создать поле', exact: true }).click();
  await page.getByRole('textbox', { name: 'Поиск на поле' }).fill('MOMS KNIFE');
  await expect(page.locator('.item-card')).toHaveCount(3);
  await expect(page.locator('.item-card .item-name').first()).toHaveText("Mom's Knife");
});

test('Russian effects retain their text while names in links and plain mentions become English', async ({ page }) => {
  await page.goto('/#reference');
  const search = page.getByRole('textbox', { name: 'Поиск в справочнике' });
  await search.fill('The Jar');
  await page.getByRole('button', { name: 'Справочник: The Jar', exact: true }).click();
  const jar = page.getByRole('dialog', { name: 'The Jar', exact: true });
  await expect(jar.locator('.item-detail-sections')).toContainText('The Jar объединяет половинки сердец в целые сердца.');
  await page.keyboard.press('Escape');
  await search.fill('Godhead');
  await page.getByRole('button', { name: 'Справочник: Godhead', exact: true }).click();
  const godhead = page.getByRole('dialog', { name: 'Godhead', exact: true });
  await expect(godhead).toContainText('Выстрелы персонажа самонаводятся и окружены аурой');
  await godhead.getByRole('link', { name: 'Trisagion', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Trisagion', exact: true })).toContainText('Эффекты и подробности');
});
