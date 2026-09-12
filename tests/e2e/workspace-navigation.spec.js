import { expect, test } from "@playwright/test";
import { launchExtensionContext } from "./extension-test-utils.js";

test("all workspace pages share localized, keyboard-accessible navigation", async () => {
  const extension = await launchExtensionContext();
  try {
    await extension.context.route("**/api/trade2/data/leagues", (route) =>
      route.fulfill({ json: { result: [] } })
    );
    const page = await extension.context.newPage();
    await page.goto(`chrome-extension://${extension.extensionId}/options.html`);
    for (const language of ["en", "ja"]) {
      await page.evaluate((uiLanguage) => chrome.storage.local.set({ uiLanguage }), language);
      for (const width of [320, 375, 414, 768, 1440]) {
        await page.setViewportSize({ width, height: 960 });
        for (const destination of ["popup", "purchase-history", "options"]) {
          const link = page.locator(`nav a[href="${destination}.html"]`);
          await link.focus();
          await page.keyboard.press("Enter");
          await expect(page).toHaveURL(new RegExp(`/${destination}\\.html$`));
          await expect(page.locator("html")).toHaveAttribute("lang", language);
          await expect(page.locator("nav a[aria-current='page']")).toHaveAttribute(
            "href",
            `${destination}.html`
          );
          await expect(page.getByRole("main")).toHaveCount(1);
          const defects = await page.locator("nav a").evaluateAll(
            (links) =>
              links.filter((element) => {
                const box = element.getBoundingClientRect();
                return box.left < 0 || box.right > innerWidth || box.height < 44;
              }).length
          );
          expect(defects, `${destination}: ${language}, ${width}px`).toBe(0);
        }
      }
    }
  } finally {
    await extension.dispose();
  }
});
