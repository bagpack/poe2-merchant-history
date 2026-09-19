import process from "node:process";
import { Buffer } from "node:buffer";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { launchExtensionContext } from "./extension-test-utils.js";

const fixture = JSON.parse(
  await readFile(new URL("../fixtures/trade-search-response.json", import.meta.url), "utf8")
).result[0];

test("sales errors focus a dialog, close with Escape, and restore focus", async () => {
  const extension = await launchExtensionContext();
  try {
    await extension.context.route("**/api/trade2/data/leagues", (route) => route.abort());
    const page = await extension.context.newPage();
    await page.goto(`chrome-extension://${extension.extensionId}/popup.html`);
    await expect(page.locator("#modal-close")).toBeFocused();
    await expect(page.locator("#modal")).toHaveJSProperty("open", true);
    await page.keyboard.press("Escape");
    await expect(page.locator("#modal")).not.toBeVisible();
    await page.locator("#csv-export").click();
    await expect(page.locator("#modal-close")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator("#csv-export")).toBeFocused();
  } finally {
    await extension.dispose();
  }
});

test("Undo stays in view after confirming the last candidate in a long list", async () => {
  const extension = await launchExtensionContext();
  try {
    const page = await extension.context.newPage();
    await page.goto(`chrome-extension://${extension.extensionId}/options.html`);
    await page.evaluate(async (entry) => {
      for (let i = 0; i < 12; i++) {
        const response = await chrome.runtime.sendMessage({
          type: "purchase/candidate",
          payload: {
            itemId: `${entry.item.id}-${i}`,
            resultId: `${entry.id}-${i}`,
            rawItem: { ...entry.item, id: `${entry.item.id}-${i}` },
            listingSnapshot: {
              resultId: `${entry.id}-${i}`,
              price: entry.listing.price,
              sellerAccount: entry.listing.account.name,
              indexedAt: entry.listing.indexed,
            },
            source: {
              pageUrl: "https://www.pathofexile.com/trade2/search/poe2/Standard/search-1",
              fetchUrl: "https://www.pathofexile.com/api/trade2/fetch/item-1",
              language: "en",
            },
            candidateAt: Date.now() - i * 60_000,
          },
        });
        if (!response.ok) throw new Error("Candidate setup failed");
      }
    }, fixture);
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`chrome-extension://${extension.extensionId}/purchase-history.html`);
      if (width === 1440) {
        const alignment = await page
          .locator('[role="columnheader"]')
          .evaluateAll((headers) => headers.map((header) => getComputedStyle(header).textAlign));
        expect(new Set(alignment)).toEqual(new Set(["center"]));
      }
      await page.locator('[data-action="purchased"]').last().click();
      await expect(page.locator("#purchase-undo-button")).toBeFocused();
      const bounds = await page.locator("#purchase-undo").boundingBox();
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(900);
      await page.locator("#purchase-undo-button").click();
      await expect(page.locator('[data-action="purchased"]')).toHaveCount(12);
    }
    await page.goto(`chrome-extension://${extension.extensionId}/purchase-history.html`);
    await expect(page.locator("#purchase-result-count")).toHaveText("12 shown / 12 records");
    const firstRow = await page.locator(".purchase-row").first().boundingBox();
    expect(firstRow.y).toBeLessThan(800);
    await page.locator("#purchase-advanced-filters > summary").click();
    await page.locator("#purchase-date-from").fill("2026-09-14");
    await page.locator("#purchase-date-to").fill("2026-09-01");
    await expect(page.locator("#purchase-date-error")).toBeVisible();
    await expect(page.locator("#purchase-date-to")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#purchase-empty")).toBeHidden();
    await expect(page.locator("#export-purchase-csv")).toBeDisabled();
    await page.locator("#clear-purchase-filters").click();
    await expect(page.locator("#purchase-date-error")).toBeHidden();
    await expect(page.locator(".purchase-row")).toHaveCount(12);
    if (process.env.UI_EVIDENCE_DIR) {
      const output = process.env.UI_EVIDENCE_DIR;
      await mkdir(output, { recursive: true });
      const measurements = [];
      await extension.context.route("**/api/trade2/data/leagues", (route) =>
        route.fulfill({ json: { result: [{ id: "Standard", text: "Standard", realm: "poe2" }] } })
      );
      for (const language of ["ja", "en"]) {
        await page.evaluate((uiLanguage) => chrome.storage.local.set({ uiLanguage }), language);
        for (const width of [1440, 768, 320]) {
          await page.setViewportSize({ width, height: 900 });
          for (const route of ["popup", "purchase-history", "options"]) {
            await page.goto(`chrome-extension://${extension.extensionId}/${route}.html`);
            await expect(page.locator("html")).toHaveAttribute("lang", language);
            if (route === "purchase-history")
              await expect(page.locator(".purchase-row")).toHaveCount(12);
            await page.screenshot({
              path: `${output}/${route}-${language}-${width}.png`,
              fullPage: true,
            });
            measurements.push(
              await page.evaluate(
                ({ route, width, language }) => ({
                  route,
                  width,
                  language,
                  scrollWidth: document.documentElement.scrollWidth,
                  firstRowTop: document.querySelector(".purchase-row")?.getBoundingClientRect().top,
                  clipped: [...document.querySelectorAll("button,input,select,summary")]
                    .filter((element) => {
                      const box = element.getBoundingClientRect();
                      return box.height > 0 && (box.left < 0 || box.right > innerWidth + 1);
                    })
                    .map((element) => element.id || element.textContent),
                }),
                { route, width, language }
              )
            );
          }
        }
      }
      await writeFile(`${output}/metrics.json`, JSON.stringify(measurements, null, 2));
      expect(measurements.flatMap((entry) => entry.clipped)).toEqual([]);
    }
  } finally {
    await extension.dispose();
  }
});

test("sales refresh remains reachable while reading the bottom of a long history", async () => {
  const extension = await launchExtensionContext();
  try {
    await extension.context.route("**/api/trade2/data/leagues", (route) =>
      route.fulfill({ json: { result: [{ id: "Standard", realm: "poe2", text: "Standard" }] } })
    );
    const page = await extension.context.newPage();
    await page.goto(`chrome-extension://${extension.extensionId}/options.html`);
    await page.evaluate(async () => {
      await chrome.storage.local.set({ uiLanguage: "en", leagueId: "Standard" });
      await new Promise((resolve, reject) => {
        const request = indexedDB.open("poe2-trade-history-en-Standard", 1);
        request.onupgradeneeded = () => {
          const store = request.result.createObjectStore("trade_history", { keyPath: "id" });
          store.createIndex("time", "time");
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("trade_history", "readwrite");
          for (let i = 0; i < 50; i++) {
            tx.objectStore("trade_history").put({
              id: String(i),
              item_name: `Ring ${i}`,
              currency: "divine",
              amount: i + 1,
              time: new Date(Date.now() - i * 86_400_000).toISOString(),
              details_json: { name: `Ring ${i}`, typeLine: "Sapphire Ring" },
            });
          }
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    });
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`chrome-extension://${extension.extensionId}/popup.html`);
      await expect(page.locator("#history-body tr")).toHaveCount(50);
      await page.locator("#history-body tr").last().scrollIntoViewIfNeeded();
      const button = await page.locator("#refresh-btn").boundingBox();
      expect(button.y).toBeGreaterThanOrEqual(0);
      expect(button.y + button.height).toBeLessThan(200);
      expect(await page.evaluate(() => scrollY)).toBeGreaterThan(500);
      if (process.env.UI_EVIDENCE_DIR) {
        await page.screenshot({ path: `${process.env.UI_EVIDENCE_DIR}/sales-sticky-${width}.png` });
      }
      await page.locator("#refresh-btn").click();
      await expect(page.locator("#modal")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.locator("#refresh-btn")).toBeFocused();
    }
  } finally {
    await extension.dispose();
  }
});

test("backup cancellation recovers and malformed records never replace stored settings", async () => {
  const extension = await launchExtensionContext();
  try {
    const page = await extension.context.newPage();
    await page.goto(`chrome-extension://${extension.extensionId}/options.html`);
    await page.evaluate(() => chrome.storage.local.set({ testSentinel: "original" }));
    const cancelled = page.waitForEvent("filechooser");
    await page.locator("#import-backup").click();
    await (await cancelled).element().dispatchEvent("cancel");
    await expect(page.locator("#import-backup")).toBeEnabled();
    const chooser = page.waitForEvent("filechooser");
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#import-backup").click();
    await (
      await chooser
    ).setFiles({
      name: "invalid-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          storageLocal: { testSentinel: "overwritten" },
          dbs: [
            {
              name: "poe2-purchase-history",
              version: 1,
              stores: {
                history: {
                  keyPath: "id",
                  autoIncrement: false,
                  indexes: [],
                  entries: [{ value: { missingKey: true } }],
                },
              },
            },
          ],
        })
      ),
    });
    await expect(page.locator("#backup-status")).toContainText("Could not process the backup");
    await expect(page.locator("#import-backup")).toBeEnabled();
    expect(await page.evaluate(() => chrome.storage.local.get("testSentinel"))).toEqual({
      testSentinel: "original",
    });
    expect(
      await page.evaluate(async () =>
        (await indexedDB.databases()).filter((db) => db.name.startsWith("backup-validation-"))
      )
    ).toEqual([]);
  } finally {
    await extension.dispose();
  }
});
