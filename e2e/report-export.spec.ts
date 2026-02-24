import { test, expect } from '@playwright/test';

// Helper: set localStorage to skip hero + tour, English for stable selectors
async function setupWithDemo(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate(() => {
    const uiState = {
      state: { lang: 'en', heroSeen: true, tourSeen: true, plotSettings: { colorScheme: 'default', fontSize: 11, showWeights: true, customTitle: '', customXLabel: '', customYLabel: '' } },
      version: 0,
    };
    localStorage.setItem('metareview-ui', JSON.stringify(uiState));
  });
  await page.reload();
  await expect(page.locator('#tab-input')).toBeVisible({ timeout: 10_000 });

  // Click "Load Demo" in header
  await page.locator('button').filter({ hasText: /Load Demo/i }).click();
  // Wait for studies to populate (demo has 7 rows)
  await expect(page.locator('table tbody tr')).toHaveCount(7, { timeout: 10_000 });
}

async function runAnalysis(page: import('@playwright/test').Page) {
  const runBtn = page.locator('[data-tour="run-analysis"]');
  await expect(runBtn).toBeEnabled();
  await runBtn.click();
  await expect(page.locator('#tab-results')).toBeEnabled({ timeout: 15_000 });
}

test.describe('MetaReview E2E — Demo → Analysis → Export', () => {
  test('Load Demo → Run Analysis → Results appear', async ({ page }) => {
    await setupWithDemo(page);
    await runAnalysis(page);

    await page.locator('#tab-results').click();
    await expect(page.locator('text=Overall Effect')).toBeVisible({ timeout: 5_000 });
  });

  test('Forest plot renders SVG after analysis', async ({ page }) => {
    await setupWithDemo(page);
    await runAnalysis(page);

    await page.locator('#tab-forest').click();

    // Use first() since hidden renderer also has a .forest-plot-container
    const svg = page.locator('.forest-plot-container svg').first();
    await expect(svg).toBeVisible({ timeout: 10_000 });

    // Should contain text elements (study labels)
    const textElements = svg.locator('text');
    await expect(textElements.first()).toBeVisible();
  });

  test('Funnel plot renders after analysis', async ({ page }) => {
    await setupWithDemo(page);
    await runAnalysis(page);

    await page.locator('#tab-funnel').click();

    // Use first() since hidden renderer also has a .funnel-plot-container
    const svg = page.locator('.funnel-plot-container svg').first();
    await expect(svg).toBeVisible({ timeout: 10_000 });
  });

  test('HTML report export opens new tab with charts', async ({ page, context }) => {
    await setupWithDemo(page);
    await runAnalysis(page);

    await page.locator('#tab-results').click();

    // Wait for hidden renderers to be ready (requestIdleCallback)
    await page.waitForTimeout(3000);

    const exportBtn = page.locator('button').filter({ hasText: /Export Report/i });
    await expect(exportBtn).toBeVisible();

    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      exportBtn.click(),
    ]);

    await newPage.waitForLoadState('domcontentloaded');

    // Report should contain SVG charts
    const reportHtml = await newPage.content();
    expect(reportHtml).toContain('<svg');
    expect(reportHtml).toContain('Overall Effect');

    // Report title uses the analysis title (demo: "Aspirin vs Placebo...")
    const reportTitle = await newPage.title();
    expect(reportTitle.length).toBeGreaterThan(0);
  });

  test('DOCX export triggers download', async ({ page }) => {
    await setupWithDemo(page);
    await runAnalysis(page);

    await page.locator('#tab-results').click();
    await page.waitForTimeout(3000);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('button').filter({ hasText: /DOCX/ }).click(),
    ]);

    expect(download.suggestedFilename()).toContain('.docx');
  });
});
