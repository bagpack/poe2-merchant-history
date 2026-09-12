import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { launchExtensionContext } from "./extension-test-utils.js";

const fixture = JSON.parse(
  await readFile(new URL("../fixtures/trade-search-response.json", import.meta.url), "utf8")
);

test("purchase history can be reviewed, confirmed, exported, and deleted", async () => {
  const extension = await launchExtensionContext();

  try {
    await extension.context.route("https://pathofexile.com/api/trade2/data/leagues", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", json: { result: [] } })
    );
    const setupPage = await extension.context.newPage();
    await setupPage.goto(`chrome-extension://${extension.extensionId}/options.html`);
    const result = structuredClone(fixture.result[0]);
    result.item.explicitMods = [
      { description: "+25 to maximum Life", flags: { fractured: true } },
      "+18% to Fire Resistance",
    ];
    const response = await setupPage.evaluate(
      (entry) =>
        chrome.runtime.sendMessage({
          type: "purchase/candidate",
          payload: {
            itemId: entry.item.id,
            resultId: entry.id,
            rawItem: entry.item,
            listingSnapshot: {
              resultId: entry.id,
              price: entry.listing.price,
              sellerAccount: entry.listing.account.name,
              indexedAt: entry.listing.indexed,
            },
            source: {
              pageUrl: "https://www.pathofexile.com/trade2/search/poe2/Standard/search-1",
              fetchUrl: "https://www.pathofexile.com/api/trade2/fetch/item-1",
              language: "en",
            },
            candidateAt: 1_000,
          },
        }),
      result
    );
    expect(response.ok).toBe(true);
    await setupPage.close();

    const page = await extension.context.newPage();
    await page.goto(`chrome-extension://${extension.extensionId}/popup.html`);
    await expect(page.locator("#purchase-pending-count")).toHaveText("1");
    await expect(page.locator("#purchase-pending-list")).toContainText("Sapphire Ring");
    await expect(page.locator("#open-purchase-history")).toHaveAttribute(
      "href",
      "purchase-history.html"
    );
    await page.goto(`chrome-extension://${extension.extensionId}/purchase-history.html`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page).toHaveURL(/purchase-history\.html$/);
    await expect(page.locator('[data-i18n="purchaseHistorySubtitle"]')).toHaveText(
      "Purchase candidates are added automatically. Confirm the result manually."
    );
    await expect(page.locator(".filters")).toHaveAttribute("aria-label", "Filters");
    await expect(page.locator("#purchase-status")).toHaveAttribute("role", "status");
    await expect(page.locator("table")).toHaveCount(0);
    await expect(page.locator(".purchase-list")).toHaveCSS("display", "grid");
    await expect(page.locator(".purchase-list")).toHaveCSS("font-variant-numeric", "tabular-nums");

    const row = page.locator("#purchase-history-body .purchase-row");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Sapphire Ring");
    await expect(row).toContainText("Pending");
    await expect(
      page.locator('[role="columnheader"][data-i18n="purchaseColumnSource"]')
    ).toHaveCount(0);
    await expect(
      page.locator('[role="columnheader"][data-i18n="purchaseColumnAttempts"]')
    ).toHaveCount(0);
    await expect(row.locator(".actions")).not.toContainText("—");
    await expect(row.locator('[data-action="purchased"]')).toHaveText("Mark as purchased");
    await expect(row.locator('[data-action="delete"]')).toHaveText("Delete candidate");
    await expect(row.locator("[data-label='Trade search'] a")).toHaveText("Open on trade site");
    await expect(row.locator('[data-action="unavailable"], [data-action="cancelled"]')).toHaveCount(
      0
    );
    await expect(row.locator("pre, details")).toHaveCount(0);
    await expect(row.locator('[data-action="detail"]')).toHaveCount(1);
    for (const width of [
      320, 375, 414, 480, 481, 600, 601, 768, 900, 901, 1024, 1259, 1260, 1280,
    ]) {
      await page.setViewportSize({ width, height: 720 });
      const pageWidth = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(pageWidth.scroll).toBeLessThanOrEqual(pageWidth.client);
      const clippedCells = await row.locator('[role="cell"]').evaluateAll((cells) =>
        cells
          .filter((cell) => {
            const box = cell.getBoundingClientRect();
            return (
              box.left < 0 || box.right > innerWidth || cell.scrollWidth > cell.clientWidth + 1
            );
          })
          .map((cell) => cell.textContent)
      );
      expect(clippedCells, `All purchase fields must fit at ${width}px`).toEqual([]);
      const overlappingCells = await row.locator('[role="cell"]').evaluateAll((cells) => {
        const boxes = cells.map((cell) => cell.getBoundingClientRect());
        return boxes.flatMap((box, index) =>
          boxes
            .slice(index + 1)
            .filter(
              (other) =>
                Math.min(box.right, other.right) > Math.max(box.left, other.left) + 1 &&
                Math.min(box.bottom, other.bottom) > Math.max(box.top, other.top) + 1
            )
        );
      });
      expect(overlappingCells, `Purchase fields must not overlap at ${width}px`).toEqual([]);
      const overflowingFilters = await page.locator(".filters label").evaluateAll((labels) =>
        labels
          .filter((label) => {
            const box = label.getBoundingClientRect();
            const control = label.querySelector("input, select").getBoundingClientRect();
            return control.left < box.left - 1 || control.right > box.right + 1;
          })
          .map((label) => label.textContent)
      );
      expect(overflowingFilters, `Filters must fit their columns at ${width}px`).toEqual([]);
      if (width <= 600) {
        await expect(row).toHaveCSS("display", "grid");
        await expect(row.locator(".item-cell")).toHaveCSS("position", "static");
        await expect(row.locator(".actions")).toHaveCSS("position", "static");
        const rowColumnCount = await row.evaluate(
          (element) => getComputedStyle(element).gridTemplateColumns.split(" ").length
        );
        expect(rowColumnCount).toBe(1);
        const actionButtonWidths = await row
          .locator(".actions button[data-action]")
          .evaluateAll((buttons) =>
            buttons.map((button) => Math.round(button.getBoundingClientRect().width))
          );
        expect(new Set(actionButtonWidths).size).toBe(1);
      }
    }
    await page.setViewportSize({ width: 1280, height: 720 });
    const desktopActionButtonWidths = await row
      .locator(".actions button[data-action]")
      .evaluateAll((buttons) =>
        buttons.map((button) => Math.round(button.getBoundingClientRect().width))
      );
    expect(new Set(desktopActionButtonWidths).size).toBe(1);
    await expect(row.locator('[data-action="delete"]')).toHaveCSS("grid-column-start", "2");
    const detailTrigger = row.locator('[data-action="detail"]');
    await expect(detailTrigger).toHaveText("Sapphire Ring");
    await detailTrigger.click();
    const dialog = page.getByRole("dialog", { name: "Sapphire Ring" });
    await expect(dialog).toBeVisible();
    await expect(page.locator("#detail-card > #detail-close")).toHaveCount(1);
    await expect(page.locator("#detail-close")).toBeFocused();
    const dialogBox = await page.locator("#detail-card").boundingBox();
    const viewport = page.viewportSize();
    expect(dialogBox).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(Math.abs(dialogBox.x + dialogBox.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(2);
    expect(Math.abs(dialogBox.y + dialogBox.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(
      2
    );
    await page.setViewportSize({ width: 320, height: 720 });
    await expect(page.locator(".item-tooltip-header")).toHaveCSS("padding-left", "12px");
    await expect(page.locator(".item-tooltip-header")).toHaveCSS("padding-right", "12px");
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.locator("#detail-body")).toContainText("+25 to maximum Life");
    await expect(page.locator("#detail-body")).toContainText("+18% to Fire Resistance");
    await expect(page.locator(".item-line-fractured")).toContainText("+25 to maximum Life");
    await expect(page.locator(".item-line-fractured")).toHaveAttribute(
      "aria-label",
      "Fractured mod: +25 to maximum Life"
    );
    await expect(page.locator("#detail-close")).toContainText("Close");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(detailTrigger).toBeFocused();

    await page.selectOption("#purchase-status-filter", "purchased");
    await expect(row).toHaveCount(0);
    await page.selectOption("#purchase-status-filter", "pending");
    await page.fill("#purchase-search", "Sapphire");
    await page.selectOption("#purchase-league-filter", "Standard");
    await expect(row).toHaveCount(1);
    await page.fill("#purchase-date-from", "1970-01-01");
    await page.fill("#purchase-date-to", "1970-01-02");
    await expect(row).toHaveCount(1);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#purchase-status-filter")).toHaveValue("pending");
    await expect(page.locator("#purchase-search")).toHaveValue("Sapphire");
    await expect(page.locator("#purchase-league-filter")).toHaveValue("Standard");
    await expect(page.locator("#purchase-date-from")).toHaveValue("1970-01-01");
    await expect(page.locator("#purchase-date-to")).toHaveValue("1970-01-02");
    await expect(page.locator("#purchase-history-body .purchase-row")).toHaveCount(1);
    await page.fill("#purchase-date-from", "1970-01-02");
    await expect(row).toHaveCount(0);
    await expect(page.locator("#purchase-empty")).toHaveText(
      "No purchase records match these filters. Change or clear the filters."
    );
    const clearFilters = page.getByRole("button", { name: "Clear filters" });
    await expect(clearFilters).toBeEnabled();
    await clearFilters.click();
    await expect(page.locator("#purchase-status-filter")).toHaveValue("");
    await expect(page.locator("#purchase-search")).toHaveValue("");
    await expect(page.locator("#purchase-league-filter")).toHaveValue("");
    await expect(page.locator("#purchase-date-from")).toHaveValue("");
    await expect(page.locator("#purchase-date-to")).toHaveValue("");
    await expect(row).toHaveCount(1);
    await expect(clearFilters).toBeDisabled();

    await expect(page.locator(".export-actions")).toContainText("Export CSV");
    await expect(page.locator(".export-actions")).toContainText("Export JSON");
    await expect(page.locator(".destructive-actions")).toContainText("Delete all purchase history");
    await expect(page.locator(".export-actions #delete-all-purchases")).toHaveCount(0);

    await row.locator('[data-action="purchased"]').click();
    await expect(row).toContainText("Purchased");
    await expect(row.locator(".actions button[data-action]")).toHaveCount(1);
    await expect(row.locator('[data-action="delete"]')).toHaveCSS("grid-column-start", "1");
    await expect(row.locator('[data-action="delete"]')).toHaveCSS("grid-column-end", "-1");
    const deleteLabelOffset = await row.locator('[data-action="delete"]').evaluate((button) => {
      const box = button.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(button);
      const label = range.getBoundingClientRect();
      return Math.abs(label.x + label.width / 2 - box.x - box.width / 2);
    });
    expect(deleteLabelOffset).toBeLessThanOrEqual(1);
    await expect(page.locator("#purchase-status")).toHaveText("Marked as purchased.");
    await expect(page.locator("#purchase-undo")).toBeVisible();
    await expect(page.locator("#purchase-undo-message")).toHaveText(
      "Sapphire Ring marked as purchased."
    );
    await expect(page.locator("#purchase-undo-seconds")).toHaveText(/\d+/);
    await expect(page.locator("#purchase-undo-remaining")).toHaveText(/\d+s left/);
    await expect(page.locator("#purchase-undo-button")).toHaveText("Undo");
    await expect(page.locator("#purchase-undo-button")).toHaveAttribute(
      "aria-label",
      "Undo the action for Sapphire Ring"
    );
    await expect(page.locator("#purchase-undo-button")).toBeFocused();
    const initialUndoOffset = await page
      .locator("#purchase-undo-progress")
      .evaluate((element) => getComputedStyle(element).strokeDashoffset);
    await page.waitForTimeout(1_000);
    const elapsedUndoOffset = await page
      .locator("#purchase-undo-progress")
      .evaluate((element) => getComputedStyle(element).strokeDashoffset);
    expect(elapsedUndoOffset).not.toBe(initialUndoOffset);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#purchase-undo")).toBeVisible();
    await expect(page.locator("#purchase-undo-button")).toHaveText("Undo");
    await page.locator("#purchase-undo-button").click();
    await expect(row).toContainText("Pending");
    await expect(page.locator("#purchase-status")).toHaveText("The last action was undone.");
    await expect(page.locator("#purchase-undo")).toBeHidden();

    await row.locator('[data-action="purchased"]').click();
    await expect(row).toContainText("Purchased");
    await expect(row.locator('[data-action="pending"]')).toHaveCount(0);
    await expect(row.locator('[data-action="purchased"]')).toHaveCount(0);
    await expect(row.locator('[data-action="delete"]')).toHaveText("Delete history");
    await expect.poll(() => page.evaluate(() => chrome.action.getBadgeText({}))).toBe("");

    const csvDownload = page.waitForEvent("download");
    await page.locator("#export-purchase-csv").click();
    const csvPath = await (await csvDownload).path();
    expect(await readFile(csvPath, "utf8")).toContain("purchased");

    const jsonDownload = page.waitForEvent("download");
    await page.locator("#export-purchase-json").click();
    const jsonPath = await (await jsonDownload).path();
    expect(await readFile(jsonPath, "utf8")).toContain("futureFieldAddedByGGG");

    await row.locator('[data-action="delete"]').click();
    await expect(page.locator("#purchase-history-body .purchase-row")).toHaveCount(0);
    await expect(page.locator("#purchase-undo")).toBeVisible();
    await expect(page.locator("#purchase-undo-message")).toHaveText("Sapphire Ring deleted.");
    await page.locator("#purchase-undo-button").click();
    await expect(page.locator("#purchase-history-body .purchase-row")).toHaveCount(1);
    await expect(page.locator("#purchase-history-body .purchase-row")).toContainText("Purchased");

    await page.locator("#purchase-history-body .purchase-row [data-action=delete]").click();
    await expect(page.locator("#purchase-history-body .purchase-row")).toHaveCount(0);
    await expect(page.locator("#purchase-undo")).toBeVisible();
    await page.evaluate(() => {
      window.__purchaseOriginalNow = Date.now;
      Date.now = () => window.__purchaseOriginalNow() + 31_000;
    });
    await expect(page.locator("#purchase-undo-message")).toHaveText("Undo expired.");
    await expect(page.locator("#purchase-undo-button")).toBeHidden();
    await page.evaluate(() => {
      Date.now = window.__purchaseOriginalNow;
      delete window.__purchaseOriginalNow;
    });
    await expect(page.locator("#purchase-empty")).toContainText(
      "Use instant purchase on the official trade site to add a candidate."
    );
    await expect(page.locator("#purchase-list-wrapper")).toBeHidden();

    const secondMessage = {
      type: "purchase/candidate",
      payload: {
        itemId: "item-2",
        resultId: "result-2",
        rawItem: { ...result.item, id: "item-2", typeLine: "Second Ring" },
        listingSnapshot: {
          resultId: "result-2",
          price: result.listing.price,
          sellerAccount: result.listing.account.name,
          indexedAt: result.listing.indexed,
        },
        source: {
          pageUrl: "https://www.pathofexile.com/trade2/search/poe2/Standard/search-2",
          fetchUrl: "https://www.pathofexile.com/api/trade2/fetch/item-2",
          language: "en",
        },
        candidateAt: 2_000,
      },
    };
    expect(
      await page.evaluate((message) => chrome.runtime.sendMessage(message), secondMessage)
    ).toMatchObject({ ok: true });
    await expect(page.locator("#purchase-history-body .purchase-row")).toHaveCount(1);
    await expect(page.locator("#purchase-history-body .purchase-row")).toContainText("Second Ring");
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("1 purchase record");
      expect(dialog.message()).toContain("cannot be restored without a backup");
      await dialog.accept();
    });
    await page.locator("#delete-all-purchases").click();
    await expect(page.locator("#purchase-history-body .purchase-row")).toHaveCount(0);

    await page.selectOption("#purchase-language", "ja");
    await expect(page.locator(".filters")).toHaveAttribute("aria-label", "絞り込み");
    await expect(page.locator("#clear-purchase-filters")).toHaveText("絞り込みを解除");
    await expect(page.locator("#delete-all-purchases")).toHaveText("購入履歴を全件削除");
  } finally {
    await extension.dispose();
  }
});

test("purchase history reflects a candidate from the trade page without reloading", async () => {
  const extension = await launchExtensionContext();

  try {
    const result = structuredClone(fixture.result[0]);
    const resultId = "b".repeat(64);
    const itemId = "a".repeat(64);
    result.id = resultId;
    result.item.id = itemId;
    await extension.context.route(
      "https://www.pathofexile.com/trade2/search/poe2/Standard/live-update",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/html",
          body: `
            <div class="row" data-id="${resultId}">
              <span data-field="fee">100</span>
              <button id="instant-purchase" class="direct-btn">Instant purchase</button>
            </div>
          `,
        })
    );
    await extension.context.route(
      new RegExp(`https://www\\.pathofexile\\.com/api/trade2/fetch/${resultId}\\?.+`),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          json: { ...fixture, result: [result] },
        })
    );

    const historyPage = await extension.context.newPage();
    await historyPage.goto(`chrome-extension://${extension.extensionId}/purchase-history.html`);
    await expect(historyPage.locator("#purchase-history-body .purchase-row")).toHaveCount(0);

    const tradePage = await extension.context.newPage();
    await tradePage.goto("https://www.pathofexile.com/trade2/search/poe2/Standard/live-update");
    await tradePage.locator("#instant-purchase").click();

    await expect(historyPage.locator("#purchase-history-body .purchase-row")).toHaveCount(1);
    await expect(historyPage.locator("#purchase-history-body .purchase-row")).toContainText(
      "Sapphire Ring"
    );
  } finally {
    await extension.dispose();
  }
});
