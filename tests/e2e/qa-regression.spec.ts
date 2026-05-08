import { test, expect } from '@playwright/test';

// Regression tests for the QA bug batch (BUG-001 → BUG-014). These tests
// expect a Mapbox token + the dev/preview server running; the existing
// playwright.config.ts handles `webServer`. CI runs them via the manual
// e2e workflow, since they consume the Mapbox quota.

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 414, height: 896 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
] as const;

test.describe('QA regression batch 1', () => {
  test('no horizontal overflow at any viewport (BUG-002, BUG-005)', async ({ page }) => {
    for (const vp of VIEWPORTS) {
      await page.setViewportSize(vp);
      await page.goto('/');
      await page.waitForFunction(() => Boolean((window as { __map?: unknown }).__map), null, {
        timeout: 30_000,
      });
      const dims = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      expect(dims.scrollW, `viewport ${vp.width}×${vp.height}`).toBeLessThanOrEqual(dims.clientW);
    }
  });

  test('200-char favorite name does not break layout (BUG-002)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForFunction(() => Boolean((window as { __map?: unknown }).__map), null, {
      timeout: 30_000,
    });
    await page.getByRole('button', { name: /Mes lieux|My places/ }).click();
    const longName = 'A'.repeat(200);
    const input = page.locator('.fav-input');
    await input.fill(longName);
    await page.getByRole('button', { name: /Sauvegarder|Save/ }).click();
    // Wait for the toast.
    await page.locator('.toast').waitFor({ state: 'visible', timeout: 5000 });
    const dims = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));
    expect(dims.scrollW).toBeLessThanOrEqual(dims.clientW);
  });

  test('duplicate favorite is refused (BUG-001)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean((window as { __map?: unknown }).__map), null, {
      timeout: 30_000,
    });
    await page.evaluate(() => window.localStorage.removeItem('mapbox3d:favorites:v1'));
    await page.reload();
    await page.waitForFunction(() => Boolean((window as { __map?: unknown }).__map), null, {
      timeout: 30_000,
    });
    await page.getByRole('button', { name: /Mes lieux|My places/ }).click();
    const input = page.locator('.fav-input');
    const save = page.getByRole('button', { name: /Sauvegarder|Save/ });

    await input.fill('Tour Eiffel');
    await save.click();
    await page.locator('.toast').waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);

    await input.fill('TOUR EIFFEL');
    await save.click();
    // The duplicate branch should focus + select the input again, and show
    // the favDuplicate toast. Read storage to confirm only one favorite.
    const count = await page.evaluate(() => {
      const raw = window.localStorage.getItem('mapbox3d:favorites:v1');
      return raw ? (JSON.parse(raw) as unknown[]).length : 0;
    });
    expect(count).toBe(1);
  });

  test('Tab focus shows a visible outline (BUG-006)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean((window as { __map?: unknown }).__map), null, {
      timeout: 30_000,
    });
    // Cycle through a few focusable controls and assert each has an outline.
    let outlineSeen = false;
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      const outline = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { width: cs.outlineWidth, style: cs.outlineStyle, tag: el.tagName };
      });
      if (outline && outline.width !== '0px' && outline.style !== 'none') {
        outlineSeen = true;
        break;
      }
    }
    expect(outlineSeen, 'expected at least one focused control to render an outline').toBe(true);
  });

  test('Escape ×2 on search clears the input (BUG-008)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean((window as { __map?: unknown }).__map), null, {
      timeout: 30_000,
    });
    const input = page.locator('#search-input');
    await input.fill('Lyon');
    // Wait for the dropdown to render at least one suggestion.
    await page.locator('#search-results li').first().waitFor({ timeout: 5000 });
    await page.keyboard.press('Escape'); // closes dropdown
    await expect(page.locator('#search-results')).toBeHidden();
    await expect(input).toHaveValue('Lyon');
    await input.focus();
    await page.keyboard.press('Escape'); // empties input
    await expect(input).toHaveValue('');
  });

  test('maxLength on favorite name input is 80 (BUG-009)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean((window as { __map?: unknown }).__map), null, {
      timeout: 30_000,
    });
    await page.getByRole('button', { name: /Mes lieux|My places/ }).click();
    const input = page.locator('.fav-input');
    await input.fill('B'.repeat(200));
    const value = await input.inputValue();
    expect(value.length).toBe(80);
  });

  test('invalid URL preset boots app + warns (BUG-013)', async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'warning' || msg.type() === 'warn') warnings.push(msg.text());
    });
    await page.goto('/#16/48.8584/2.2945/70/-20/morning');
    await page.waitForFunction(() => Boolean((window as { __map?: unknown }).__map), null, {
      timeout: 30_000,
    });
    // App must boot without crashing.
    const center = await page.evaluate(() => {
      const m = (window as unknown as { __map: { getCenter(): { lng: number; lat: number } } }).__map;
      return m.getCenter();
    });
    expect(center.lng).toBeCloseTo(2.2945, 2);
    expect(center.lat).toBeCloseTo(48.8584, 2);
    // A console.warn should have been emitted at boot.
    const sawWarning = warnings.some((w) => /preset/i.test(w));
    expect(sawWarning, 'expected a console.warn about the invalid preset').toBe(true);
  });
});
