/**
 * @file One describe block per UI Playground tile.
 *
 * Each widget prints what happened in its grey "out-*" line, so most tests act on the widget
 * and then assert on that line.
 * Run: `npx playwright test specs/playground.spec.ts`
 */
import { test, expect } from '@playwright/test';
import { labUrl } from '../support/lab';

test.beforeEach(async ({ page }) => { await page.goto(labUrl('playground')); });

/** Click types, disabled state and a button that enables itself after 5 seconds. */
test.describe('Buttons', () => {
  test('click, double-click and right-click', async ({ page }) => {
    const out = page.getByTestId('out-buttons');
    await page.getByTestId('btn-click').click();
    await page.getByTestId('btn-click').click();
    await expect(out).toHaveText('Clicked 2 times');
    await page.getByTestId('btn-double').dblclick();
    await expect(out).toHaveText('Double-clicked');
    await page.getByTestId('btn-right').click({ button: 'right' });
    await expect(out).toHaveText('Right-clicked');
  });

  test('disabled and delayed buttons', async ({ page }) => {
    await expect(page.getByTestId('btn-disabled')).toBeDisabled();
    const delayed = page.getByTestId('btn-delayed');
    await expect(delayed).toBeDisabled();
    await expect(delayed).toBeEnabled({ timeout: 8_000 }); // wait for state, never sleep
    await delayed.click();
    await expect(page.getByTestId('out-buttons')).toHaveText('Delayed button clicked');
  });
});

/** Alert, confirm and prompt built as in-page modals. */
test.describe('Dialogs (in-page modals)', () => {
  test('alert', async ({ page }) => {
    await page.getByTestId('dialog-alert').click();
    await page.getByTestId('dialog').getByTestId('dialog-ok').click();
    await expect(page.getByTestId('dialog')).toBeHidden();
    await expect(page.getByTestId('out-dialogs')).toHaveText('Alert accepted');
  });

  test('confirm: cancel and accept', async ({ page }) => {
    await page.getByTestId('dialog-confirm').click();
    await page.getByTestId('dialog-cancel').click();
    await expect(page.getByTestId('out-dialogs')).toHaveText('Confirm: cancelled');
    await page.getByTestId('dialog-confirm').click();
    await expect(page.getByRole('dialog')).toContainText('Delete draft?');
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByTestId('out-dialogs')).toHaveText('Confirm: accepted');
  });

  test('prompt with text, and Escape closes', async ({ page }) => {
    await page.getByTestId('dialog-prompt').click();
    await page.getByTestId('dialog-input').fill('checkout-smoke');
    await page.getByTestId('dialog-ok').click();
    await expect(page.getByTestId('out-dialogs')).toHaveText('Prompt: checkout-smoke');
    await page.getByTestId('dialog-prompt').click();
    await expect(page.getByTestId('dialog-input')).toBeFocused(); // the modal listens for Escape once focus is inside it
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('dialog')).toBeHidden();
  });
});

/** Text, password, number and read-only inputs. */
test.describe('Text inputs', () => {
  test('type, clear and read back', async ({ page }) => {
    await page.getByTestId('input-text').fill('hello');
    await page.getByTestId('input-number').fill('42');
    await expect(page.getByTestId('out-inputs')).toHaveText('text="hello" number=42');
    await page.getByTestId('input-text').clear();
    await page.getByTestId('input-text').pressSequentially('slow typing', { delay: 20 });
    await expect(page.getByTestId('input-text')).toHaveValue('slow typing');
  });

  test('number out of range is flagged', async ({ page }) => {
    await page.getByTestId('input-number').fill('150');
    await expect(page.getByTestId('input-number')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByTestId('out-inputs')).toContainText('(out of range)');
  });

  test('password show/hide and read-only field', async ({ page }) => {
    const pw = page.getByTestId('input-password');
    await expect(pw).toHaveAttribute('type', 'password');
    await page.getByTestId('password-toggle').click();
    await expect(pw).toHaveAttribute('type', 'text');
    await expect(page.getByTestId('password-toggle')).toHaveText('Hide');
    await expect(page.getByTestId('input-readonly')).not.toBeEditable();
    await expect(page.getByTestId('input-readonly')).toHaveValue('KM-ORDER-50001');
  });

  test('find inputs by label, the way users do', async ({ page }) => {
    await page.getByLabel('Text', { exact: true }).fill('by label');
    await expect(page.getByTestId('input-text')).toHaveValue('by label');
  });
});

/** Native select, multi-select and a custom combobox that is not a <select>. */
test.describe('Dropdowns', () => {
  test('native select by label and by value', async ({ page }) => {
    await page.getByTestId('select-native').selectOption({ label: 'Mango' });
    await expect(page.getByTestId('out-dropdowns')).toContainText('native=Mango');
    await page.getByTestId('select-native').selectOption('Banana');
    await expect(page.getByTestId('select-native')).toHaveValue('Banana');
  });

  test('disabled option cannot be chosen', async ({ page }) => {
    await expect(page.getByTestId('select-native').locator('option', { hasText: 'Cherry' })).toBeDisabled();
  });

  test('multi-select', async ({ page }) => {
    await page.getByTestId('select-multi').selectOption(['Playwright', 'k6']);
    await expect(page.getByTestId('out-dropdowns')).toContainText('multi=[Playwright, k6]');
  });

  test('custom combobox (not a <select>)', async ({ page }) => {
    const box = page.getByTestId('select-custom');
    await expect(box).toHaveAttribute('aria-expanded', 'false');
    await box.click();
    await expect(page.getByTestId('select-custom-list')).toBeVisible();
    await page.getByRole('option', { name: 'Denver' }).click();
    await expect(box).toHaveText('Denver');
    await expect(page.getByTestId('out-dropdowns')).toContainText('custom=Denver');
  });
});

/** Checkbox group with "select all", a radio group and a toggle switch. */
test.describe('Checkboxes and radios', () => {
  test('select all checks every box', async ({ page }) => {
    await expect(page.getByTestId('check-email')).toBeChecked();
    await page.getByTestId('check-all').check();
    for (const id of ['check-email', 'check-sms', 'check-push']) await expect(page.getByTestId(id)).toBeChecked();
    await expect(page.getByTestId('out-choices')).toContainText('checked=[Email, SMS, Push]');
  });

  test('unchecking one clears "select all"', async ({ page }) => {
    await page.getByTestId('check-all').check();
    await page.getByTestId('check-sms').uncheck();
    await expect(page.getByTestId('check-all')).not.toBeChecked();
  });

  test('radio group and toggle switch', async ({ page }) => {
    await expect(page.getByTestId('radio-pro')).toBeChecked();
    await page.getByLabel('Team').check();
    await expect(page.getByTestId('radio-pro')).not.toBeChecked();
    await page.getByTestId('toggle-switch').check();
    await expect(page.getByTestId('out-choices')).toContainText('plan=Team toggle=true');
  });
});

/** Range, date, time and color inputs. */
test.describe('Sliders and pickers', () => {
  test('range, date, time and color', async ({ page }) => {
    await page.getByTestId('picker-range').fill('75');
    await page.getByTestId('picker-date').fill('2026-12-24');
    await page.getByTestId('picker-time').fill('09:30');
    await page.getByTestId('picker-color').fill('#ff0000');
    await expect(page.getByTestId('out-pickers')).toHaveText('range=75 date=2026-12-24 time=09:30 color=#ff0000');
  });

  test('slider moves with the keyboard', async ({ page }) => {
    await page.getByTestId('picker-range').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('picker-range')).toHaveValue('42');
  });
});

/** Elements that appear later and a progress bar: wait for state, never sleep. */
test.describe('Waiting', () => {
  test('dynamic loading: the element is added later', async ({ page }) => {
    await expect(page.getByTestId('dynamic-result')).toHaveCount(0); // not hidden: absent
    await page.getByTestId('dynamic-start').click();
    await expect(page.getByTestId('dynamic-loading')).toBeVisible();
    await expect(page.getByTestId('dynamic-result')).toHaveText('Hello, tester!');
    await expect(page.getByTestId('dynamic-loading')).toHaveCount(0);
  });

  test('progress bar reaches 100%', async ({ page }) => {
    await page.getByTestId('progress-start').click();
    await expect(page.getByTestId('out-progress')).toHaveText('Upload complete', { timeout: 15_000 });
    await expect(page.getByTestId('progress-bar')).toHaveAttribute('aria-valuenow', '100');
  });

  test('progress can be stopped part way', async ({ page }) => {
    await page.getByTestId('progress-start').click();
    await expect.poll(async () => Number(await page.getByTestId('progress-bar').getAttribute('aria-valuenow'))).toBeGreaterThan(20);
    await page.getByTestId('progress-stop').click();
    await expect(page.getByTestId('out-progress')).toHaveText(/^Stopped at \d+%$/);
  });
});

/** Lists that grow and shrink, and elements that come and go between reloads. */
test.describe('Changing elements', () => {
  test('add and remove list items', async ({ page }) => {
    for (let i = 0; i < 3; i++) await page.getByTestId('list-add').click();
    await expect(page.getByTestId('list-item')).toHaveCount(3);
    await page.getByTestId('list-item').filter({ hasText: 'Item 2' }).getByTestId('list-delete').click();
    await expect(page.getByTestId('list-item')).toHaveText(['Item 1 Delete', 'Item 3 Delete']);
    await page.getByTestId('list-clear').click();
    await expect(page.getByTestId('out-list')).toHaveText('0 items');
  });

  test('flaky tile: locate by test ID, not by random id', async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await page.getByTestId('flaky-reload').click();
      await expect(page.getByTestId('flaky-status')).toBeVisible();
      await expect(page.getByTestId('flaky-status')).toHaveAttribute('id', /^status-/); // id changes every time
      expect(await page.getByTestId('flaky-gallery').count()).toBeLessThanOrEqual(1); // sometimes there, sometimes not
    }
  });
});

/** Drag and drop, key presses, infinite scroll and an accordion. */
test.describe('Mouse and keyboard', () => {
  test('drag and drop moves a card to Done', async ({ page }) => {
    await page.getByTestId('dnd-item').filter({ hasText: 'Cart test' }).dragTo(page.getByTestId('dnd-target'));
    await expect(page.getByTestId('dnd-target').getByTestId('dnd-item')).toHaveText(['Cart test']);
    await expect(page.getByTestId('out-dnd')).toHaveText('1 in Done');
  });

  test('key presses, with and without Shift', async ({ page }) => {
    await page.getByTestId('keys-input').press('Enter');
    await expect(page.getByTestId('out-keys')).toHaveText('Last key: Enter');
    await page.getByTestId('keys-input').press('Shift+KeyA');
    await expect(page.getByTestId('out-keys')).toHaveText('Last key: A (with Shift)');
  });

  test('infinite scroll loads more rows', async ({ page }) => {
    const box = page.getByTestId('scroll-container');
    await expect(page.getByTestId('scroll-item')).toHaveCount(20);
    await box.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect(page.getByTestId('scroll-item')).toHaveCount(40);
    await expect(page.getByTestId('out-scroll')).toHaveText('40 of 100 rows loaded');
  });

  test('accordion opens and closes', async ({ page }) => {
    const faq = page.getByTestId('faq-2');
    await expect(faq).not.toHaveAttribute('open', '');
    await faq.getByText('Can I load test it?').click();
    await expect(faq).toHaveAttribute('open', '');
    await expect(faq).toContainText('Light k6 runs are fine.');
  });
});

/** Uploads, downloads, new tabs, popups, iframes and shadow DOM. */
test.describe('Files, windows and frames', () => {
  test('upload files from memory', async ({ page }) => {
    await page.getByTestId('upload-input').setInputFiles([
      { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('a'.repeat(2048)) },
      { name: 'data.csv', mimeType: 'text/csv', buffer: Buffer.from('id,name\n1,test\n') },
    ]);
    await expect(page.getByTestId('upload-item')).toHaveCount(2);
    await expect(page.getByTestId('upload-item').first()).toHaveText('notes.txt · 2.0 KB');
  });

  test('download a generated file and read it', async ({ page }) => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-csv').click()]);
    expect(download.suggestedFilename()).toBe('kestrel-products.csv');
    const text = await (await import('fs')).promises.readFile((await download.path())!, 'utf8');
    expect(text.split('\n')[0]).toBe('id,sku,name,category,price,stock');
    await expect(page.getByTestId('out-downloads')).toContainText('Downloaded kestrel-products.csv');
  });

  test('download a static file', async ({ page }) => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-static').click()]);
    expect(download.suggestedFilename()).toBe('sample-orders.csv');
  });

  test('new tab', async ({ page, context }) => {
    const [tab] = await Promise.all([context.waitForEvent('page'), page.getByTestId('window-new-tab').click()]);
    await tab.waitForLoadState();
    await expect(tab).toHaveTitle(/Terms/i);
    await tab.close();
  });

  test('popup window', async ({ page }) => {
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByTestId('window-popup').click()]);
    await popup.waitForLoadState();
    expect(popup.url()).toMatch(/\/terms(\.html)?$/);
    await expect(page.getByTestId('out-windows')).toHaveText('Popup opened');
  });

  test('iframe form', async ({ page }) => {
    const frame = page.frameLocator('[data-testid="frame-newsletter"]');
    await frame.getByTestId('frame-email').fill('tester@example.com');
    await frame.getByTestId('frame-submit').click();
    await expect(frame.getByTestId('frame-message')).toHaveText('Subscribed: tester@example.com');
  });

  test('shadow DOM input', async ({ page }) => {
    await page.getByTestId('shadow-host').getByTestId('shadow-input').fill('SAVE10');
    await page.getByTestId('shadow-button').click();
    await expect(page.getByTestId('out-shadow')).toHaveText('Shadow input: SAVE10');
  });
});

/** A 3px shift and a color change, caught by geometry and by screenshots. */
test.describe('Visual change', () => {
  test('the card moves 3px when the change is on', async ({ page }) => {
    // Measure against the tile, not the viewport: check() may scroll the page.
    const offset = () => page.getByTestId('visual-card').evaluate((el) => el.getBoundingClientRect().top - el.closest('section')!.getBoundingClientRect().top);
    const before = await offset();
    await page.getByTestId('visual-toggle').check();
    await expect.poll(async () => Math.round((await offset()) - before)).toBe(3);
  });

  test('screenshots before and after differ (no saved baseline needed)', async ({ page }) => {
    const card = page.getByTestId('visual-card');
    const before = await card.screenshot({ animations: 'disabled' });
    await page.getByTestId('visual-toggle').check();
    await expect.poll(async () => Buffer.compare(before, await card.screenshot({ animations: 'disabled' }))).not.toBe(0);
  });

  /**
   * Baseline comparison with toHaveScreenshot. Baselines depend on OS and fonts, so this is opt-in.
   * First run: `VISUAL=1 npx playwright test -g "matches its baseline" --update-snapshots`.
   */
  test('card matches its baseline', async ({ page }) => {
    test.skip(!process.env.VISUAL, 'Set VISUAL=1 to run baseline screenshot tests');
    await expect(page.getByTestId('visual-card')).toHaveScreenshot('visual-card.png');
  });
});

/** A 12-row employee table with sorting, filtering and paging. */
test.describe('Sortable, filterable table', () => {
  test('sorted by name and paged', async ({ page }) => {
    await expect(page.getByTestId('table-info')).toHaveText('12 rows · page 1 of 3');
    await expect(page.getByTestId('table-row').first().getByRole('cell').first()).toHaveText('Ana Ruiz');
    await page.getByTestId('table-page-3').click();
    await expect(page.getByTestId('table-row')).toHaveCount(2);
  });

  test('sort by salary both ways', async ({ page }) => {
    const firstSalary = page.getByTestId('table-row').first().getByRole('cell').nth(3);
    await page.getByTestId('sort-salary').click();
    await expect(firstSalary).toHaveText('$87,000');
    await page.getByTestId('sort-salary').click();
    await expect(firstSalary).toHaveText('$125,000');
  });

  test('every page is in order', async ({ page }) => {
    await page.getByTestId('sort-salary').click();
    const all: number[] = [];
    for (const p of [1, 2, 3]) {
      await page.getByTestId(`table-page-${p}`).click();
      await expect(page.getByTestId(`table-page-${p}`)).toHaveAttribute('aria-current', 'page');
      const cells = await page.getByTestId('table-row').evaluateAll((rows) => rows.map((r) => Number(r.children[3].textContent!.replace(/\D/g, ''))));
      all.push(...cells);
    }
    expect(all).toHaveLength(12);
    expect(all).toEqual([...all].sort((a, b) => a - b));
  });

  test('filter by team', async ({ page }) => {
    await page.getByTestId('table-filter').fill('qa');
    await expect(page.getByTestId('table-info')).toHaveText('4 rows · page 1 of 1');
    await page.getByTestId('table-filter').fill('nobody');
    await expect(page.getByTestId('data-table')).toContainText('No rows match.');
  });
});
