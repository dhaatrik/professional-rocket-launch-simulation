import { test, expect } from '@playwright/test';

test('Verify script editor accessibility labels', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Wait for and click the start button on the splash screen
  await page.waitForSelector('#start-btn', { state: 'visible' });
  await page.click('#start-btn');

  // Wait for fade animation (e.g., 2 seconds)
  await page.waitForTimeout(2000);

  // Dismiss tooltip if it exists by pressing Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);

  // Open the script editor using the button
  // ID from previous explorations might be #open-script-btn
  await page.evaluate("document.getElementById('open-script-btn')?.click()");
  await page.waitForTimeout(1000);

  // Take a screenshot of the script editor modal
  await page.screenshot({ path: '/home/jules/verification/script_editor_open.png', fullPage: true });
});
