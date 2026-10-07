import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const test = base.extend<{ browserHealth: void }>({
  browserHealth: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(`Page error: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(`Console error: ${message.text()}`);
    });
    page.on('response', response => {
      if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
    });
    page.on('requestfailed', request => {
      // Navigating or reloading can intentionally abort an in-flight request.
      if (request.failure()?.errorText !== 'net::ERR_ABORTED') {
        errors.push(`Failed request: ${request.url()} (${request.failure()?.errorText})`);
      }
    });
    await use();
    expect(errors, 'The app must not emit browser errors or fail to load assets').toEqual([]);
  }, { auto: true }],
});

async function openBoard(page: Page) {
  await page.goto('/');
  await expect(page.locator('.item-card')).toHaveCount(30);
  await expect.poll(async () => page.locator('.item-card img').evaluateAll(images =>
    images.every(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0),
  ), { message: 'All board item icons should load successfully' }).toBe(true);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(overflow.document, 'Document should fit the mobile viewport').toBeLessThanOrEqual(overflow.viewport + 1);
  expect(overflow.body, 'Body should fit the mobile viewport').toBeLessThanOrEqual(overflow.viewport + 1);
}

test('player flips are independent and survive reloads', async ({ page }) => {
  await openBoard(page);
  const firstId = await page.locator('.item-card').nth(0).getAttribute('data-item-id');
  const secondId = await page.locator('.item-card').nth(1).getAttribute('data-item-id');
  const firstCard = page.locator(`[data-item-id="${firstId}"]`);
  const secondCard = page.locator(`[data-item-id="${secondId}"]`);

  await firstCard.click();
  await expect(firstCard).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Поле: Игрок 1', exact: true })).toContainText('29 из 30 осталось');

  await page.getByRole('button', { name: 'Поле: Игрок 2', exact: true }).click();
  await expect(firstCard).toHaveAttribute('aria-pressed', 'false');
  await secondCard.click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Поле: Игрок 2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(firstCard).toHaveAttribute('aria-pressed', 'false');
  await expect(secondCard).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Поле: Игрок 1', exact: true }).click();
  await expect(firstCard).toHaveAttribute('aria-pressed', 'true');
  await expect(secondCard).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Только оставшиеся', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(29);
  await expect(firstCard).toHaveCount(0);
  await page.getByRole('button', { name: 'Только оставшиеся', exact: true }).click();
  await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
  await expect(firstCard).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Поле: Игрок 2', exact: true }).click();
  await expect(secondCard).toHaveAttribute('aria-pressed', 'true');
});

test('settings save names, additional players, and field preferences', async ({ page }) => {
  await openBoard(page);
  await page.getByRole('button', { name: 'Настроить игроков', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Ваша игра, ваши правила' });
  await dialog.getByRole('textbox', { name: 'Имя игрока 1', exact: true }).fill('Саша');
  await dialog.getByRole('textbox', { name: 'Имя игрока 2', exact: true }).fill('Миша');
  await dialog.getByRole('button', { name: 'Добавить игрока', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Имя игрока 4', exact: true }).fill('Лена');
  await dialog.getByRole('spinbutton', { name: 'Предметов на поле', exact: true }).fill('12');
  await dialog.getByRole('combobox', { name: 'Столбцов на компьютере', exact: true }).selectOption('4');
  await dialog.getByRole('checkbox', { name: 'Показывать названия предметов', exact: true }).uncheck();
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();

  await expect(dialog).toBeHidden();
  await expect(page.locator('.player-button')).toHaveCount(4);
  await expect(page.locator('.item-card')).toHaveCount(12);
  await expect(page.locator('.item-card.no-name')).toHaveCount(12);
  await expect(page.getByRole('button', { name: 'Поле: Саша', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Поле: Лена', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Поле: Лена', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.item-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Настроить поле', exact: true }).click();
  await expect(dialog.getByRole('spinbutton', { name: 'Предметов на поле', exact: true })).toHaveValue('12');
  await expect(dialog.getByRole('combobox', { name: 'Столбцов на компьютере', exact: true })).toHaveValue('4');
  await expect(dialog.getByRole('checkbox', { name: 'Показывать названия предметов', exact: true })).not.toBeChecked();
  await dialog.getByRole('button', { name: 'Удалить игрока 4', exact: true }).click();
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.locator('.player-button')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Поле: Саша', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('catalogue builds and persists an intentionally small custom field', async ({ page }) => {
  await openBoard(page);
  await page.getByRole('button', { name: /^Набор предметов/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Соберите свой набор' });
  await dialog.getByRole('button', { name: 'Снять выбор', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Создать поле', exact: true })).toBeDisabled();

  for (const name of ['The Sad Onion', 'The Inner Eye', 'Spoon Bender']) {
    await dialog.getByRole('textbox', { name: 'Поиск в каталоге', exact: true }).fill(name);
    await dialog.getByRole('button', { name: `Добавить ${name}`, exact: true }).click();
  }
  await dialog.getByRole('button', { name: 'Создать поле', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(3);
  expect((await page.locator('.item-card').evaluateAll(cards => cards.map(card => Number(card.getAttribute('data-item-id'))))).sort()).toEqual([1, 2, 3]);
  await page.reload();
  await expect(page.locator('.item-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Настроить поле', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Предметов на поле', exact: true })).toHaveValue('3');
  await page.getByRole('button', { name: 'Закрыть окно', exact: true }).click();
  await page.getByRole('button', { name: /^Набор предметов/ }).click();
  await expect(dialog.locator('.catalogue-item.selected')).toHaveCount(3);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('roulette animates a field item, hides the result, and restores each player’s secret', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openBoard(page);
  const boardNames = await page.locator('.item-card .item-name').allTextContents();
  await page.getByRole('button', { name: 'Рулетка', exact: true }).click();
  await page.getByRole('button', { name: /^С игрового поля/ }).click();
  await page.getByRole('button', { name: 'Крутить рулетку', exact: true }).click();
  await expect(page.locator('.roulette-stage')).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('button', { name: 'Выбираем предмет…', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: /^С игрового поля/ })).toBeDisabled();

  const result = page.getByRole('button', { name: /^Скрыть выбранный предмет:/ });
  await expect(result).toBeVisible({ timeout: 10_000 });
  const secretName = await result.locator('strong').innerText();
  expect(boardNames).toContain(secretName);
  await expect(page.locator('.roulette-item.is-winner .roulette-item-name')).toHaveText(secretName);
  await expect(page.locator('.roulette-stage')).toHaveAttribute('aria-busy', 'false');

  await result.click();
  await expect(page.getByRole('button', { name: 'Показать выбранный предмет', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Показать секретный предмет игрока Игрок 1', exact: true })).toBeVisible();
  await expect(page.locator('.roulette-result-card img')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Показать выбранный предмет', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Показать выбранный предмет', exact: true }).click();
  await expect(page.getByRole('button', { name: `Скрыть выбранный предмет: ${secretName}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Поле: Игрок 2', exact: true }).click();
  await expect(page.getByText('Здесь будет твой предмет', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Поле: Игрок 1', exact: true }).click();
  await expect(page.getByRole('button', { name: `Скрыть выбранный предмет: ${secretName}`, exact: true })).toBeVisible();
});

test('a new field clears player progress and secrets after confirmation', async ({ page }) => {
  await openBoard(page);
  await page.locator('.item-card').first().click();
  await page.getByRole('button', { name: 'Рулетка', exact: true }).click();
  await page.getByRole('button', { name: 'Крутить рулетку', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Скрыть выбранный предмет:/ })).toBeVisible();
  await page.getByRole('button', { name: 'Игровое поле', exact: true }).click();
  await page.getByRole('button', { name: 'Новое поле', exact: true }).click();
  await page.getByRole('button', { name: 'Продолжить игру', exact: true }).click();
  await expect(page.locator('.item-card[aria-pressed="true"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Новое поле', exact: true }).click();
  await page.getByRole('button', { name: 'Начать заново', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(30);
  await expect(page.locator('.item-card[aria-pressed="true"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Рулетка', exact: true }).click();
  await expect(page.getByText('Здесь будет твой предмет', { exact: true })).toBeVisible();
});

test('undo cannot overwrite a newly chosen hidden secret or another player’s state', async ({ page }) => {
  await openBoard(page);
  await page.locator('.item-card').first().click();
  await expect(page.getByRole('button', { name: 'Назад', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Рулетка', exact: true }).click();
  await page.getByRole('button', { name: 'Крутить рулетку', exact: true }).click();
  const result = page.getByRole('button', { name: /^Скрыть выбранный предмет:/ });
  await expect(result).toBeVisible();
  const secret = await result.locator('strong').innerText();
  await result.click();
  await page.getByRole('button', { name: 'Игровое поле', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Назад', exact: true })).toBeDisabled();
  await page.locator('.item-card').nth(1).click();
  await page.getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(page.locator('.item-card[aria-pressed="true"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Рулетка', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Показать выбранный предмет', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Показать выбранный предмет', exact: true }).click();
  await expect(page.getByRole('button', { name: `Скрыть выбранный предмет: ${secret}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Игровое поле', exact: true }).click();
  await page.locator('.item-card').nth(1).click();
  await page.getByRole('button', { name: 'Поле: Игрок 2', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Назад', exact: true })).toBeDisabled();
  await expect(page.locator('.item-card[aria-pressed="true"]')).toHaveCount(0);
});

test('mobile layout fits the viewport across navigation and dialogs', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openBoard(page);
  await expectNoHorizontalOverflow(page);
  await page.locator('.item-card').first().click();
  await expect(page.locator('.item-card[aria-pressed="true"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Настроить поле', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: 'Закрыть окно', exact: true }).click();
  await page.getByRole('button', { name: /^Набор предметов/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: 'Закрыть окно', exact: true }).click();
  await page.getByRole('button', { name: 'Рулетка', exact: true }).click();
  await expect(page).toHaveURL(/#roulette$/);
  await expect(page.getByRole('heading', { name: 'Один предмет. Твой секрет.', exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: 'Крутить рулетку', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Скрыть выбранный предмет:/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.goBack();
  await expect(page.getByRole('region', { name: 'Игровое поле Игрок 1', exact: true })).toBeVisible();
  await expect(page.locator('.item-card[aria-pressed="true"]')).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
});

test('item information is separate from elimination and nested dialogs close independently', async ({ page }) => {
  await openBoard(page);
  const name = await page.locator('.item-card .item-name').first().innerText();
  await page.getByRole('button', { name: `Описание ${name}`, exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText(name, { exact: true }).last()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.item-card[aria-pressed="true"]')).toHaveCount(0);
  await page.getByRole('button', { name: /^Набор предметов/ }).click();
  const catalogue = page.getByRole('dialog', { name: 'Соберите свой набор' });
  await catalogue.getByRole('button', { name: 'Описание The Sad Onion', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(catalogue).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('grid presets, presentation preferences and exact field codes work', async ({ page }) => {
  await openBoard(page);
  await page.getByRole('button', { name: /^Набор предметов/ }).click();
  const builder = page.getByRole('dialog', { name: 'Соберите свой набор' });
  await builder.getByRole('button', { name: /Только легенды/ }).click();
  await builder.getByRole('spinbutton', { name: 'Размер создаваемого поля' }).fill('10');
  await builder.getByRole('button', { name: 'Оформление и код поля' }).click();
  await builder.getByRole('combobox', { name: 'Язык названий' }).selectOption('ru');
  await builder.getByRole('combobox', { name: 'Сортировка поля' }).selectOption('id');
  await builder.getByRole('combobox', { name: 'Группировать по' }).selectOption('quality');
  await builder.getByRole('combobox', { name: 'Стиль исключения' }).selectOption('dim');
  await builder.getByRole('button', { name: 'Тема: Планетарий', exact: true }).click();
  await builder.getByRole('button', { name: 'Создать поле', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(10);
  await expect(page.locator('.board-panel')).toHaveAttribute('data-theme', 'purple');
  await expect(page.locator('.board-group-heading')).toHaveText('Качество 410');
  await expect(page.locator('.item-card .quality-4')).toHaveCount(10);
  await page.locator('.item-card').first().click();
  await expect(page.locator('.item-card.is-dimmed')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.item-card.is-dimmed')).toHaveCount(1);
  await expect(page.locator('.board-panel')).toHaveAttribute('data-theme', 'purple');
  await page.getByRole('button', { name: /^Набор предметов/ }).click();
  await builder.getByRole('button', { name: 'Оформление и код поля' }).click();
  await builder.getByRole('textbox', { name: 'Код поля' }).fill('IGC1:3.1.2');
  await builder.getByRole('button', { name: 'Открыть поле', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(3);
  // ID sorting is applied to the displayed field; the imported underlying order is retained.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('isaac-guess-club:v1')!).boardIds)).toEqual([3, 1, 2]);
  await expect(page.locator('.item-card[aria-pressed="true"]')).toHaveCount(0);
});

test('source descriptions retain unlocks and open references across categories', async ({ page }) => {
  await openBoard(page);
  await page.getByRole('button', { name: 'Справочник', exact: true }).click();
  await page.getByRole('textbox', { name: 'Поиск в справочнике' }).fill('Godhead');
  await page.getByRole('button', { name: 'Справочник: Godhead', exact: true }).click();
  const details = page.getByRole('dialog', { name: 'Божественность' });
  await expect(details.getByText('Как открыть', { exact: true })).toBeVisible();
  await expect(details).toContainText('Потерянного');
  await expect(details).toContainText('Angel Room');
  await expect(details.locator('.item-detail-metadata')).toContainText('156');
  await details.getByRole('link', { name: 'Трисвятое', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Трисвятое' })).toContainText('Trisagion');
  await page.keyboard.press('Escape');
  await page.getByRole('textbox', { name: 'Поиск в справочнике' }).fill('Bad Gas');
  await page.getByRole('button', { name: 'Справочник: Bad Gas', exact: true }).click();
  const pill = page.getByRole('dialog', { name: 'Вонючий Газ' });
  await expect(pill).toContainText('Отравляет');
  await expect(pill.locator('.item-detail-badges')).toContainText('#0');
  await expect(pill.locator('.detail-quality')).toHaveCount(0);
  await pill.getByRole('link', { name: 'Плацебо', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Плацебо' })).toContainText('Placebo');
});

test('quality, source pools, tags and Greed mode determine the created set', async ({ page }) => {
  await openBoard(page);
  await page.getByRole('button', { name: /^Набор предметов/ }).click();
  const builder = page.getByRole('dialog', { name: 'Соберите свой набор' });
  for (const quality of [0, 1, 2, 3]) {
    await builder.getByRole('button', { name: `Качество ${quality}`, exact: true }).click();
  }
  await builder.getByRole('checkbox', { name: 'Greed mode', exact: true }).check();
  await builder.getByRole('combobox', { name: 'Пул предметов' }).selectOption('Greed Angel Room');
  await builder.getByRole('combobox', { name: 'Теги предметов' }).selectOption('Rebirth');
  await expect(builder.locator('.catalogue-item')).toHaveCount(4);
  await builder.getByRole('button', { name: 'Весь выбранный набор', exact: true }).click();
  await builder.getByRole('button', { name: 'Создать поле', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(4);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('isaac-guess-club:v1')!).poolIds)).toEqual([108, 182, 313, 331]);
  await page.reload();
  await expect(page.locator('.item-card')).toHaveCount(4);
  await page.getByRole('button', { name: 'Новое поле', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('isaac-guess-club:v1')!).boardIds.sort((a: number, b: number) => a - b))).toEqual([108, 182, 313, 331]);
});

test('the complete set and mobile reference fit and load locally', async ({ page }) => {
  await openBoard(page);
  await page.getByRole('button', { name: /^Набор предметов/ }).click();
  const builder = page.getByRole('dialog', { name: 'Соберите свой набор' });
  await builder.getByRole('button', { name: 'Весь выбранный набор', exact: true }).click();
  await builder.getByRole('button', { name: 'Создать поле', exact: true }).click();
  await expect(page.locator('.item-card')).toHaveCount(718);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Справочник', exact: true }).click();
  await expectNoHorizontalOverflow(page);
  await page.getByRole('textbox', { name: 'Поиск в справочнике' }).fill('Swallowed Penny');
  await page.getByRole('button', { name: 'Справочник: Swallowed Penny', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Проглоченный Пенни' })).toContainText('При получении урона');
  await expectNoHorizontalOverflow(page);
  await expect.poll(async () => page.locator('.item-details-icon img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
});
