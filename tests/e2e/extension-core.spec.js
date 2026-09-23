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
    {
      item_id: "item-2",
      item: { league: "Runes of Aldur", name: "", typeLine: "Exalted Item" },
      price: { currency: "exalted", amount: 98_765 },
      time: "2026-01-01T01:00:00.000Z",
    },
    {
      item_id: "item-3",
      item: { league: "Runes of Aldur", name: "", typeLine: "Chaos Item" },
      price: { currency: "chaos", amount: 4_321 },
      time: "2026-01-01T02:00:00.000Z",
    },
    {
      item_id: "item-4",
      item: { league: "Runes of Aldur", name: "", typeLine: "Annul Item" },
      price: { currency: "annul", amount: 10_250 },
      time: "2026-01-01T03:00:00.000Z",
    },
  ],
};

const TRADE_SEARCH_API_FIXTURE = JSON.parse(
  await readFile(new URL("../fixtures/trade-search-response.json", import.meta.url), "utf8")
);

test("options backup export includes storage and IndexedDB data", async () => {
  const extension = await launchExtensionContext();

  try {
    await extension.context.addCookies([
      {
        name: "POESESSID",
        value: "test-session",
        domain: ".pathofexile.com",
        path: "/",
        secure: true,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
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
    const purchaseResult = TRADE_SEARCH_API_FIXTURE.result[0];
    expect(
      await setupPage.evaluate(
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
        purchaseResult
      )
    ).toMatchObject({ ok: true });
    await setupPage.close();

    const page = await extension.context.newPage();
    await page.goto(`chrome-extension://${extension.extensionId}/options.html`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("設定");
    await expect(page.getByRole("heading", { level: 2, name: "ログイン状態" })).toBeVisible();
    await expect(page.locator(".cookie-row")).toContainText("公式サイトのログイン情報");
    await expect(page.locator(".cookie-row")).not.toContainText("POESESSID");
    await expect(page.locator(".status-ok")).toHaveText("取得済み");
    await expect(page.locator(".status-ok")).not.toContainText("期限");
    await expect(page.getByRole("button", { name: "バックアップ出力" })).toBeVisible();
    await expect(page.getByRole("button", { name: "バックアップから復元" })).toBeVisible();
    await expect(page.locator("#backup-restore-warning")).toContainText(
      "現在の設定・販売履歴・購入履歴を置き換えます"
    );
    await expect(page.locator("#export-backup")).toHaveClass(/secondary-action/);
    await expect(page.locator("#import-backup")).toHaveClass(/danger/);
    await expect(page.locator(".restore-zone #backup-restore-warning")).toHaveCount(1);
    await expect(page.locator(".restore-zone #import-backup")).toHaveCount(1);
    await expect(page.locator(".restore-zone #export-backup")).toHaveCount(0);
    await expect(page.locator("#backup-status")).toHaveAttribute("role", "status");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(12, 16, 23)");
    await expect(page.locator("body")).toHaveCSS("font-family", /system-ui/);

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
    expect(payload.dbs.some((db) => db.name === "poe2-purchase-history")).toBe(true);

    expect(
      await page.evaluate(() => chrome.runtime.sendMessage({ type: "purchase/delete-all" }))
    ).toMatchObject({ ok: true });
    expect(
      await page.evaluate(() => chrome.runtime.sendMessage({ type: "purchase/list" }))
    ).toMatchObject({ ok: true, data: [] });

    const fileChooserPromise = page.waitForEvent("filechooser");
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("バックアップを読み込みますか");
      await dialog.accept();
    });
    await page.getByRole("button", { name: "バックアップから復元" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);
    await expect(page.locator("#backup-status")).toHaveText("バックアップを復元しました。");
    expect(
      await page.evaluate(() => chrome.runtime.sendMessage({ type: "purchase/list" }))
    ).toMatchObject({
      ok: true,
      data: [{ itemId: purchaseResult.item.id, status: "pending" }],
    });
  } finally {
    await extension.dispose();
  }
});

test("popup loads leagues and uses the language selected in settings", async () => {
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
    await expect(page.locator(".chart-section")).toBeHidden();

    await page.getByRole("link", { name: "Settings" }).click();
    await page.selectOption("#language-select", "ja");
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
    await page.getByRole("link", { name: "販売履歴" }).click();
    await expect(page.locator("[data-i18n='labelLeague']")).toHaveText("リーグ");
    await expect(page.locator("#sales-history-title")).toHaveText("販売履歴");
    await expect(page.getByLabel("アイテム名を検索")).toBeVisible();
    await expect(page.getByLabel("1ページの表示件数")).toBeVisible();
    await expect(page.locator(".table-section table")).toHaveCSS(
      "font-variant-numeric",
      "tabular-nums"
    );

    const clippedCsvWidths = [];
    for (const width of [801, 900, 1024, 1180, 1181, 1280, 1440]) {
      await page.setViewportSize({ width, height: 720 });
      const csvButtonFits = await page.locator("#csv-export").evaluate((button) => {
        const buttonBox = button.getBoundingClientRect();
        const controlsBox = button.parentElement.getBoundingClientRect();
        const label = document.createRange();
        label.selectNodeContents(button);
        const labelBox = label.getBoundingClientRect();
        return (
          buttonBox.left >= controlsBox.left &&
          buttonBox.right <= controlsBox.right &&
          labelBox.left >= buttonBox.left &&
          labelBox.right <= buttonBox.right &&
          button.scrollWidth <= button.clientWidth
        );
      });
      if (!csvButtonFits) clippedCsvWidths.push(width);
    }
    expect(clippedCsvWidths).toEqual([]);

    for (const width of [320, 375, 414, 768]) {
      await page.setViewportSize({ width, height: 720 });
      const pageWidth = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(pageWidth.scroll).toBeLessThanOrEqual(pageWidth.client);
      if (width === 320) {
        const primaryControlHeights = await page
          .locator("#league-select, #refresh-btn, #open-purchase-history")
          .evaluateAll((elements) =>
            elements.map((element) => Math.round(element.getBoundingClientRect().height))
          );
        expect(Math.min(...primaryControlHeights)).toBeGreaterThanOrEqual(44);
      }
    }
  } finally {
    await extension.dispose();
  }
});

test("sales item details use an accessible item-name trigger and dialog", async () => {
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
    await extension.context.route("https://pathofexile.com/api/trade2/data/leagues", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", json: LEAGUES_API_FIXTURE })
    );
    await extension.context.route(
      "https://pathofexile.com/api/trade2/history/Runes%20of%20Aldur",
      (route) =>
        route.fulfill({ status: 200, contentType: "application/json", json: HISTORY_API_FIXTURE })
    );

    const page = await extension.context.newPage();
    await page.goto(`chrome-extension://${extension.extensionId}/popup.html`);
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect(page.locator("#sales-status")).toContainText("Total");
    await expect(page.locator(".chart-section")).toBeVisible();
    await expect(page.locator(".day-summary img")).toHaveCount(4);
    expect(
      await page
        .locator(".day-summary img")
        .first()
        .evaluate((image) => image.naturalWidth)
    ).toBeGreaterThan(0);
    await expect(page.locator(".day-summary dd")).toContainText([
      "4",
      "1",
      "98,765",
      "4,321",
      "10,250",
    ]);
    await expect(page.locator("#history-body .currency-value img")).toHaveCount(4);
    await expect(page.locator("#history-body")).toContainText("98,765");
    const dayFrame = page.locator(".film-frame");
    await expect(dayFrame).toHaveCount(1);
    await expect(dayFrame.locator(".film-sale-count")).toHaveText("4 sales");
    await expect(dayFrame.locator("img")).toHaveCount(0);
    await expect(dayFrame.locator(".film-gauge")).toHaveCount(0);
    expect(
      await dayFrame.evaluate((frame) => frame.getBoundingClientRect().height)
    ).toBeLessThanOrEqual(90);
    await dayFrame.click();
    await expect(dayFrame).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#selected-date-label")).toContainText("Showing");
    await page.locator("#show-all-dates").click();
    await expect(dayFrame).toHaveAttribute("aria-pressed", "false");

    const detailTrigger = page.getByRole("button", { name: "Test Item" });
    await detailTrigger.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: "Test Item" });
    await expect(dialog).toBeVisible();
    await expect(page.locator("#detail-card > #detail-close")).toHaveCount(1);
    await expect(page.locator("#detail-close")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(detailTrigger).toBeFocused();
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

test("purchase candidate is upserted once with its complete raw item and pending badge", async () => {
  const extension = await launchExtensionContext();

  try {
    const page = await extension.context.newPage();
    await page.goto(`chrome-extension://${extension.extensionId}/popup.html`);
    const result = TRADE_SEARCH_API_FIXTURE.result[0];
    const message = {
      type: "purchase/candidate",
      payload: {
        itemId: result.item.id,
        resultId: result.id,
        rawItem: result.item,
        listingSnapshot: {
          resultId: result.id,
          price: result.listing.price,
          sellerAccount: result.listing.account.name,
          indexedAt: result.listing.indexed,
        },
        source: {
          pageUrl: "https://www.pathofexile.com/trade2/search/poe2/Standard/search-1",
          fetchUrl: "https://www.pathofexile.com/api/trade2/fetch/item-1",
          language: "en",
        },
        candidateAt: 1_000,
      },
    };

    const firstResponse = await page.evaluate(
      (candidate) => chrome.runtime.sendMessage(candidate),
      message
    );
    const secondResponse = await page.evaluate(
      (candidate) =>
        chrome.runtime.sendMessage({
          ...candidate,
          payload: { ...candidate.payload, candidateAt: 2_000 },
        }),
      message
    );
    const records = await page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const request = indexedDB.open("poe2-purchase-history");
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction("purchases", "readonly");
            const getAll = tx.objectStore("purchases").getAll();
            getAll.onsuccess = () => resolve(getAll.result);
            getAll.onerror = () => reject(getAll.error);
          };
          request.onerror = () => reject(request.error);
        })
    );
    const badgeText = await page.evaluate(() => chrome.action.getBadgeText({}));

    expect(firstResponse, JSON.stringify(firstResponse)).toMatchObject({ ok: true });
    expect(secondResponse, JSON.stringify(secondResponse)).toMatchObject({ ok: true });
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe("pending");
    expect(records[0].candidateAt).toBe(1_000);
    expect(records[0].updatedAt).toBe(2_000);
    expect(records[0].schemaVersion).toBe(1);
    expect(records[0]).not.toHaveProperty("attemptCount");
    expect(records[0]).not.toHaveProperty("confirmationSource");
    expect(records[0].rawItem.futureFieldAddedByGGG).toEqual({
      value: 123,
      nested: ["a", "b"],
    });
    expect(badgeText).toBe("1");
  } finally {
    await extension.dispose();
  }
});
