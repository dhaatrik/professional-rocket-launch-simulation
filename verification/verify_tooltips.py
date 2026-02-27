
import asyncio
from playwright.async_api import async_playwright, expect

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Navigate to the application
        await page.goto("http://localhost:8080")

        # Wait for the VAB button to be visible and click it
        vab_button = page.get_by_text("VEHICLE ASSEMBLY (VAB)")
        await expect(vab_button).to_be_visible()
        await vab_button.click()

        # Wait for VAB modal to appear
        vab_modal = page.locator("#vab-modal")
        await expect(vab_modal).to_be_visible()

        # Check for tooltips on stats
        # We need to hover over a stat to make the tooltip appear (though standard HTML title tooltips don't appear in screenshots usually,
        # verifying the attribute exists is the key here).

        # Verify Total Delta V stat has title
        dv_stat = page.locator(".vab-stat").filter(has_text="Total ΔV")
        await expect(dv_stat).to_have_attribute("title", "Total change in velocity. Approx 9,400 m/s required for Low Earth Orbit.")

        # Verify TWR stat has title
        twr_stat = page.locator(".vab-stat").filter(has_text="TWR (Stage 1)")
        await expect(twr_stat).to_have_attribute("title", "Thrust-to-Weight Ratio. Must be > 1.0 to liftoff. Ideal is 1.3-1.5.")

        # Verify Avionics indicator has title
        avionics = page.locator(".vab-stat-indicator").filter(has_text="Avionics")
        await expect(avionics).to_have_attribute("title", "Flight computer guidance. Required for control.")

        # Take a screenshot of the VAB with stats visible
        await page.screenshot(path="verification/vab_stats_tooltips.png")

        print("Verification successful: Tooltips attributes are present.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
