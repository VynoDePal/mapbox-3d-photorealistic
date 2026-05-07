import { test, expect } from '@playwright/test';

test.describe('Recherche autocomplete', () => {
  test('Tour Eiffel → flyTo Paris', async ({ page }) => {
    await page.goto('/');

    // Wait for the map to expose itself (set in non-prod builds).
    await page.waitForFunction(() => Boolean((window as { __map?: unknown }).__map), null, {
      timeout: 30_000,
    });

    const input = page.locator('#search-input');
    await input.fill('Tour Eiffel');

    const results = page.locator('#search-results li');
    await expect(results.first()).toBeVisible({ timeout: 10_000 });

    const before = await page.evaluate(() => {
      const map = (window as unknown as { __map: { getCenter(): { lng: number; lat: number } } }).__map;
      return map.getCenter();
    });

    await results.first().click();

    // The flyTo runs ~5s. Wait for the camera to converge near the Eiffel Tower.
    await page.waitForFunction(
      () => {
        const map = (
          window as unknown as {
            __map: { getCenter(): { lng: number; lat: number }; getZoom(): number };
          }
        ).__map;
        const c = map.getCenter();
        return Math.abs(c.lng - 2.2945) < 0.05 && Math.abs(c.lat - 48.8584) < 0.05 && map.getZoom() > 14;
      },
      null,
      { timeout: 15_000 }
    );

    const after = await page.evaluate(() => {
      const map = (window as unknown as { __map: { getCenter(): { lng: number; lat: number } } }).__map;
      return map.getCenter();
    });
    expect(after.lng).not.toBe(before.lng);
  });
});
