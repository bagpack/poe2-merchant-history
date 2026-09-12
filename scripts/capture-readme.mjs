// README-only sample data. Uses an isolated profile and blocks external requests.
import { chromium, expect } from "@playwright/test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const profile = await mkdtemp(path.join(os.tmpdir(), "poe2-readme-"));
const output = path.resolve("docs/images");
await mkdir(output, { recursive: true });
const context = await chromium.launchPersistentContext(profile, {
  channel: "chromium",
  headless: true,
  viewport: { width: 1440, height: 1060 },
  timezoneId: "Asia/Tokyo",
  args: [
    `--disable-extensions-except=${path.resolve("dist")}`,
    `--load-extension=${path.resolve("dist")}`,
  ],
});
try {
  await context.route(/^https?:/, (route) => {
    if (new URL(route.request().url()).pathname === "/api/trade2/data/leagues") {
      return route.fulfill({
        json: { result: [{ id: "Standard", realm: "poe2", text: "Standard" }] },
      });
    }
    return route.abort();
  });
  const worker = context.serviceWorkers()[0] || (await context.waitForEvent("serviceworker"));
  const base = `chrome-extension://${new URL(worker.url()).host}`;
  const page = await context.newPage();
  await page.goto(`${base}/options.html`);
  await page.evaluate(async () => {
    const names = [
      "Sapphire Ring",
      "Gold Amulet",
      "Leather Belt",
      "Prismatic Ring",
      "Ruby Ring",
      "Iron Ring",
    ];
    const items = names.map((typeLine, i) => ({
      id: `readme-sample-${i}`,
      name: i === 0 ? "Dusk Circle" : "",
      typeLine,
      frameType: i === 0 ? 2 : 0,
      rarity: i === 0 ? "Rare" : "Normal",
      ilvl: 82,
      league: "Standard",
      implicitMods: ["+25% to Cold Resistance"],
      explicitMods: [
        "+68 to maximum Life",
        "+32% to Fire Resistance",
        "+24% to Lightning Resistance",
      ],
      requirements: [{ name: "Level", values: [["65", 0]], displayMode: 0 }],
    }));
    await chrome.storage.local.set({
      uiLanguage: "ja",
      leagueId: "Standard",
      legacyDbMigrated_Standard: true,
    });
    for (const language of ["ja", "en"]) {
      await new Promise((resolve, reject) => {
        const request = indexedDB.open(`poe2-trade-history-${language}-Standard`, 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("trade_history", { keyPath: "id" });
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("trade_history", "readwrite");
          items.forEach((item, i) =>
            tx.objectStore("trade_history").put({
              id: `sale-${i}`,
              item_name: item.typeLine,
              currency: i % 3 === 0 ? "divine" : "exalted",
              amount: [2, 45, 18, 1, 32, 12][i],
              time: new Date(Date.UTC(2026, 8, 12 - i, 9, 15)).toISOString(),
              details_json: item,
            })
          );
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    }
    for (const [i, item] of items.entries()) {
      const result = await chrome.runtime.sendMessage({
        type: "purchase/candidate",
        payload: {
          itemId: item.id,
          resultId: `listing-${i}`,
          rawItem: item,
          listingSnapshot: {
            resultId: `listing-${i}`,
            price: {
              amount: [2, 30, 15, 1, 25, 10][i],
              currency: i % 3 === 0 ? "divine" : "exalted",
              type: "~price",
            },
            sellerAccount: `SampleSeller${i + 1}`,
            indexedAt: "2026-09-12T08:00:00Z",
          },
          source: {
            pageUrl: "https://www.pathofexile.com/trade2/search/poe2/Standard/sample",
            fetchUrl: `https://www.pathofexile.com/api/trade2/fetch/${item.id}`,
            language: "en",
          },
          candidateAt: Date.UTC(2026, 8, 12, 9 - i, 30),
        },
      });
      if (!result.ok) throw new Error("Sample purchase seed failed");
    }
    // Mark two rows purchased directly in the test database, without a transient Undo notice.
    await new Promise((resolve, reject) => {
      const request = indexedDB.open("poe2-purchase-history", 2);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("purchases", "readwrite");
        const store = tx.objectStore("purchases");
        const all = store.getAll();
        all.onsuccess = () => {
          all.result
            .filter((record) => [items[1].id, items[3].id].includes(record.itemId))
            .forEach((record) => {
              store.put({
                ...record,
                status: "purchased",
                purchasedAt: record.candidateAt + 300000,
              });
            });
        };
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  });
  for (const language of ["ja", "en"]) {
    await page.evaluate((uiLanguage) => chrome.storage.local.set({ uiLanguage }), language);
    const suffix = language === "ja" ? "" : "-en";
    await page.goto(`${base}/popup.html`);
    await expect(page.locator("#history-body tr")).toHaveCount(6);
    await expect(page.locator("#purchase-pending-count")).toHaveText("4");
    await page.waitForTimeout(1200); // Wait for the chart's initial animation to finish.
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${output}/dashboard${suffix}.png`, fullPage: true });
    await page.goto(`${base}/purchase-history.html`);
    await expect(page.locator(".purchase-row")).toHaveCount(6);
    await expect(page.locator('[data-action="purchased"]')).toHaveCount(4);
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${output}/purchase-history${suffix}.png`, fullPage: true });
    await page.locator('[data-action="detail"]').first().click();
    await expect(page.locator("#detail-modal")).toBeVisible();
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${output}/details${suffix}.png` });
  }
  console.log("Saved six README screenshots with synthetic data.");
} finally {
  await context.close();
  await rm(profile, { recursive: true, force: true });
}
