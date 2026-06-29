import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { launchExtensionContext } from "./extension-test-utils.js";

const LEAGUES_API_FIXTURE = {
  result: [
    { id: "Runes of Aldur", realm: "poe2", text: "Runes of Aldur" },
    { id: "Standard", realm: "poe2", text: "Standard" },
  ],
};

const HISTORY_API_FIXTURE = {
  result: [
    {
      item_id: "item-1",
      item: {
        league: "Runes of Aldur",
        name: "",
        typeLine: "Test Item",
      },
      price: {
        currency: "divine",
        amount: 1,
      },
      time: "2026-01-01T00:00:00.000Z",
    },
  ],
};

test("options backup export includes storage and IndexedDB data", async () => {
  const extension = await launchExtensionContext();

  try {
    const setupPage = await extension.context.newPage();
    await setupPage.goto(`chrome-extension://${extension.extensionId}/options.html`);

    await setupPage.evaluate(async () => {
      await new Promise((resolve) =>
        chrome.storage.local.set({ leagueId: "Fate of the Vaal", uiLanguage: "ja" }, resolve)
      );

      await new Promise((resolve, reject) => {
        const req = indexedDB.open("poe2-trade-history-ja-fate_of_the_vaal", 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          const store = db.createObjectStore("trade_history", { keyPath: "id" });
          store.createIndex("time", "time", { unique: false });
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("trade_history", "readwrite");
          tx.objectStore("trade_history").put({
            id: "item-1",
            item_name: "Test Item",
            currency: "divine",
            amount: 1,
            time: "2026-01-01T00:00:00.000Z",
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    });
    await setupPage.close();

    const page = await extension.context.newPage();
    await page.goto(`chrome-extension://${extension.extensionId}/options.html`);
    await expect(page.getByRole("button", { name: "バックアップ出力" })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "バックアップ出力" }).click();
    const download = await downloadPromise;
    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const content = await readFile(filePath, "utf-8");
    const payload = JSON.parse(content);

    expect(payload.storageLocal.uiLanguage).toBe("ja");
    expect(payload.storageLocal.leagueId).toBe("Fate of the Vaal");
    expect(payload.dbs.some((db) => db.name === "poe2-trade-history-ja-fate_of_the_vaal")).toBe(
      true
    );
  } finally {
    await extension.dispose();
  }
});

test("popup loads leagues and supports language switch", async () => {
  const extension = await launchExtensionContext();

  try {
    await extension.context.route("https://pathofexile.com/api/trade2/data/leagues", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        json: LEAGUES_API_FIXTURE,
      })
    );
    await extension.context.route("https://jp.pathofexile.com/api/trade2/data/leagues", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        json: LEAGUES_API_FIXTURE,
      })
    );

    const page = await extension.context.newPage();
    await page.goto(`chrome-extension://${extension.extensionId}/popup.html`);

    await expect(page.locator("#league-select option")).toHaveCount(2);
    await expect(page.locator("#league-select")).toContainText("Runes of Aldur");

    await page.selectOption("#language-select", "ja");
    await expect(page.locator("[data-i18n='labelLeague']")).toHaveText("リーグ");
  } finally {
    await extension.dispose();
  }
});

test("history update throttles automatic requests but not user requests", async () => {
  const extension = await launchExtensionContext();

  try {
    await extension.context.addCookies([
      {
        name: "POESESSID",
        value: "test-session",
        domain: "pathofexile.com",
        path: "/",
        secure: true,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await extension.context.route(
      "https://pathofexile.com/api/trade2/history/Runes%20of%20Aldur",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          json: HISTORY_API_FIXTURE,
        })
    );

    const page = await extension.context.newPage();
    await page.goto(`chrome-extension://${extension.extensionId}/popup.html`);
    await page.evaluate(async () => {
      await new Promise((resolve) => chrome.storage.local.remove(["lastHistoryFetchAt"], resolve));
    });

    const firstUserResponse = await page.evaluate(() =>
      chrome.runtime.sendMessage({
        type: "updateHistory",
        leagueId: "Runes of Aldur",
        language: "en",
        requestSource: "user",
      })
    );
    const secondUserResponse = await page.evaluate(() =>
      chrome.runtime.sendMessage({
        type: "updateHistory",
        leagueId: "Runes of Aldur",
        language: "en",
        requestSource: "user",
      })
    );

    expect(firstUserResponse.ok).toBe(true);
    expect(secondUserResponse.ok).toBe(true);

    await page.evaluate(async () => {
      await new Promise((resolve) => chrome.storage.local.remove(["lastHistoryFetchAt"], resolve));
    });
    const firstAutomaticResponse = await page.evaluate(() =>
      chrome.runtime.sendMessage({
        type: "updateHistory",
        leagueId: "Runes of Aldur",
        language: "en",
        requestSource: "automatic",
      })
    );
    const secondAutomaticResponse = await page.evaluate(() =>
      chrome.runtime.sendMessage({
        type: "updateHistory",
        leagueId: "Runes of Aldur",
        language: "en",
        requestSource: "automatic",
      })
    );

    expect(firstAutomaticResponse.ok).toBe(true);
    expect(secondAutomaticResponse.ok).toBe(false);
    expect(secondAutomaticResponse.error.code).toBe("RATE_LIMIT");
  } finally {
    await extension.dispose();
  }
});
