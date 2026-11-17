import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

function cell(page: Page, employee: string, column: number) {
    return page
        .getByRole('row', { name: new RegExp(employee) })
        .getByRole('button')
        .nth(column);
}

function coverage(page: Page, column: number) {
    return page
        .getByRole('row', { name: /Покрытие/ })
        .getByRole('cell')
        .nth(column);
}

test('04 — назначение, смена через полночь, поиск, редактирование и покрытие', async ({ page }) => {
    await page.goto('/');
    const first = cell(page, 'Кузнецова Алина', 0);
    const second = cell(page, 'Кузнецова Алина', 1);
    await first.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await second.click({ modifiers: ['Shift'] });
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await expect(second).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('2 ячейки', { exact: true })).toBeVisible();
    const panel = page.getByRole('complementary', { name: 'Настройка смен' });
    await panel.getByLabel('Начало').fill('22:00');
    await panel.getByLabel('Конец').fill('06:30');
    await panel.getByRole('button', { name: 'Поставить в выделенные' }).click();
    await expect(first).toContainText('8 ч 30 мин');
    await expect(second).toContainText('8 ч 30 мин');
    await expect(coverage(page, 0)).toHaveText('1');

    await first.click();
    const editor = page.getByRole('dialog');
    await editor.getByLabel('Начало').fill('21:00');
    await editor.getByRole('button', { name: 'Изменить время' }).click();
    await expect(first).toContainText('9 ч 30 мин');
    await first.click();
    await editor.getByRole('button', { name: 'Удалить смену' }).click();
    await expect(coverage(page, 0)).toHaveText('0');

    await page.getByRole('searchbox', { name: 'Поиск по ФИО' }).fill('волков');
    await expect(page.getByRole('rowheader', { name: /Волков/ })).toBeVisible();
    await expect(page.getByRole('rowheader', { name: /Кузнецова/ })).toHaveCount(0);
    await expect(coverage(page, 1)).toHaveText('1');
    await page.getByRole('columnheader').getByRole('button').nth(2).click();
    await editor.getByRole('checkbox', { name: 'Волков Тимур' }).check();
    await editor.getByRole('button', { name: /День/ }).click();
    await expect(cell(page, 'Волков Тимур', 2)).toContainText('10 - 18');
    await panel.getByRole('button', { name: /Вечер/ }).dragTo(cell(page, 'Волков Тимур', 3));
    await expect(cell(page, 'Волков Тимур', 3)).toContainText('15 - 23');
    await cell(page, 'Волков Тимур', 3).dragTo(cell(page, 'Волков Тимур', 4));
    await expect(coverage(page, 3)).toHaveText('0');
    await expect(coverage(page, 4)).toHaveText('1');
});

test('05 — черновик локален, а публикация доступна в другом браузерном контексте', async ({
    page,
    browser,
}) => {
    await page.goto('/');
    const first = cell(page, 'Кузнецова Алина', 0);
    await first.click();
    await page.getByRole('dialog').getByRole('button', { name: /Утро/ }).click();
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await page.reload();
    await expect(first).toContainText('07 - 15');
    await expect(first).toHaveAccessibleName(/07:00 – 15:00/);
    const secondContext = await browser.newContext();
    const visitor = await secondContext.newPage();
    try {
        await visitor.goto('/?view=published');
        await expect(coverage(visitor, 0)).toHaveText('0');
        await page.getByRole('button', { name: 'Опубликовать', exact: true }).click();
        await expect(page.getByRole('status')).toHaveText('График опубликован.');
        await expect
            .poll(() => page.evaluate(() => localStorage.getItem('shift-scheduler:draft')))
            .toBeNull();
        await visitor.reload();
        await expect(coverage(visitor, 0)).toHaveText('1');
        await expect(visitor.getByRole('row', { name: /Кузнецова Алина/ })).toContainText(
            '07 - 15',
        );
    } finally {
        await secondContext.close();
    }
});

test('06 — перелистывает периоды и прокручивает месячный календарь на мобильном', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const grid = page.getByLabel('Таблица графика смен');
    const period = page.getByRole('group', { name: 'Период графика' });
    const original = await period.innerText();
    await page.getByRole('button', { name: 'Следующий период' }).click();
    await expect(period).not.toHaveText(original);
    await page.getByRole('button', { name: 'Предыдущий период' }).click();
    await expect(period).toHaveText(original);
    await page.getByRole('button', { name: 'Месяц', exact: true }).click();
    expect(await grid.getByRole('columnheader').count()).toBeGreaterThanOrEqual(29);
    await grid.evaluate((element) => {
        element.scrollLeft = element.scrollWidth;
    });
    expect(await grid.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => document.body.scrollWidth)).toBe(390);
});

test('07 — выделяет несколько ячеек касаниями', async ({ browser, baseURL }) => {
    const context = await browser.newContext({
        baseURL,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
    });
    try {
        const page = await context.newPage();
        await page.goto('/');
        const first = cell(page, 'Кузнецова Алина', 3);
        const second = cell(page, 'Волков Тимур', 3);
        await first.tap();
        await page.getByRole('button', { name: 'Выбрать несколько ячеек' }).tap();
        await second.tap();
        await expect(first).toHaveAttribute('aria-pressed', 'true');
        await expect(second).toHaveAttribute('aria-pressed', 'true');
        const panel = page.getByRole('complementary', { name: 'Настройка смен' });
        await panel.getByLabel('Начало').fill('09:15');
        await panel.getByLabel('Конец').fill('17:45');
        await panel.getByRole('button', { name: 'Поставить в выделенные' }).tap();
        await expect(first).toContainText('09:15 - 17:45');
        await expect(second).toContainText('09:15 - 17:45');
        const { lines, contained } = await first
            .locator('.ScheduleGrid-interval')
            .evaluate((interval) => {
                const card = interval.closest('button')!.getBoundingClientRect();
                const range = document.createRange();
                range.selectNodeContents(interval);
                const textRects = Array.from(range.getClientRects());
                return {
                    lines: textRects.length,
                    contained: textRects.every(
                        (line) => line.left >= card.left && line.right <= card.right,
                    ),
                };
            });
        expect(lines).toBe(2);
        expect(contained).toBe(true);
    } finally {
        await context.close();
    }
});
