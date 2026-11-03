import { test, expect } from '@playwright/test';

test.describe('E2E Website Verification Suite', () => {
  test('Home Page renders with correct branding, hero, and value proposition', async ({
    page,
  }) => {
    await page.goto('/');

    // Check title and branding
    await expect(page).toHaveTitle(/Apex Digital Studio/);
    const logo = page.locator('.site-header .brand-logo');
    await expect(logo).toBeVisible();

    // Check Hero Section
    const heroHeading = page.locator('.hero-heading');
    await expect(heroHeading).toBeVisible();
    await expect(heroHeading).toContainText('fast, modern websites');

    // Check Value Proposition Pillars
    const pillars = page.locator('.pillar-card');
    await expect(pillars).toHaveCount(4);

    // Check Hero graphic and floating badges
    const heroGraphic = page.locator('.hero-graphic-wrapper');
    await expect(heroGraphic).toBeVisible();
    const heroImage = page.locator('.hero-image');
    await expect(heroImage).toBeVisible();

    // Check Showcase Gallery
    const showcaseCards = page.locator('.showcase-card');
    await expect(showcaseCards).toHaveCount(3);
  });

  test('Services Page displays separate offerings and deliverables', async ({ page }) => {
    await page.goto('/services');

    await expect(page).toHaveTitle(/Our Services/);

    const serviceCards = page.locator('.service-detail-card');
    await expect(serviceCards).toHaveCount(4);

    // Verify first service details
    const firstService = serviceCards.first();
    await expect(firstService.locator('.service-title')).toContainText('Bespoke Web Design');
    await expect(firstService.locator('.deliverables-list')).toBeVisible();

    // Verify process roadmap
    const processSteps = page.locator('.process-card');
    await expect(processSteps).toHaveCount(4);
  });

  test('Contact Page form submits successfully and shows confirmation alert', async ({ page }) => {
    await page.goto('/contact');

    await expect(page).toHaveTitle(/Contact Us/);

    // Fill out form
    await page.fill('#name', 'Jane Miller');
    await page.fill('#email', 'jane.miller@example.com');
    await page.selectOption('#subject', 'Website Redesign & Development');
    await page.fill('#message', 'Hello team, we need a complete redesign with enterprise security.');

    // Wait slightly to exceed the 1.5s anti-bot velocity timer
    await page.waitForTimeout(1600);

    // Submit form
    await page.click('#submitBtn');

    // Verify confirmation alert appears
    const alertBox = page.locator('#formAlert');
    await expect(alertBox).toBeVisible({ timeout: 10000 });
    await expect(alertBox).toHaveClass(/alert-success/);
    await expect(alertBox).toContainText('received');
  });

  test('Mobile responsive layout: no horizontal scrolling / pinching on mobile viewport', async ({
    page,
  }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Verify brand logo and theme toggle are visible on mobile
    const logo = page.locator('.site-header .brand-logo');
    await expect(logo).toBeVisible();
    const themeBtn = page.locator('#themeToggle');
    await expect(themeBtn).toBeVisible();

    // Verify no horizontal overflow (scrollWidth should equal clientWidth)
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
  });

  test('Dark theme is default and theme toggle switches between dark and light modes', async ({
    page,
  }) => {
    await page.goto('/');

    // Verify dark mode is active by default
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');

    // Click theme toggle to switch to light mode
    const themeBtn = page.locator('#themeToggle');
    await expect(themeBtn).toBeVisible();
    await themeBtn.click();

    // Verify light mode is set
    await expect(html).toHaveAttribute('data-theme', 'light');

    // Click again to toggle back to dark mode
    await themeBtn.click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
  });

  test('Back button appears on subpages and navigates back to Home', async ({ page }) => {
    await page.goto('/services');

    // Header Back button near ApexStudio should be removed
    const headerBack = page.locator('#headerBackBtn');
    await expect(headerBack).toHaveCount(0);

    // Page Back link should be visible in hero and contain only arrow (no 'Back' text)
    const pageBack = page.locator('.page-back-link');
    await expect(pageBack).toBeVisible();
    await expect(pageBack).not.toContainText('Back');

    // Click hero back button to return to home
    await pageBack.click();
    await expect(page).toHaveURL(/(\/$|$)/);
    await expect(page).toHaveTitle(/Apex Digital Studio/);

    // Test on /contact page
    await page.goto('/contact');
    const contactHeaderBack = page.locator('#headerBackBtn');
    await expect(contactHeaderBack).toHaveCount(0);

    const contactPageBack = page.locator('.page-back-link');
    await expect(contactPageBack).toBeVisible();
    await contactPageBack.click();
    await expect(page).toHaveURL(/(\/$|$)/);
  });
});
