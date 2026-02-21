import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { launchExtensionContext } from "./extension-test-utils.js";

const TRADE_HISTORY_FIXTURE = `<!doctype html>
<html>
  <head><meta charset="utf-8"></head>
  <body>
    <script>
      require(["trade"], function(t) {
        t({"leagues":[{"id":"Fate of the Vaal","text":"Fate of the Vaal"},{"id":"Standard","text":"Standard"}]});
      });
    </script>
  </body>
</html>`;

test("options backup export includes storage and IndexedDB data", async () => {
  const extension = await launchExtensionContext();

  try {
    const page = await extension.context.newPage();
    await page.goto(`chrome-extension://${extension.extensionId}/options.html`);

    await page.evaluate(async () => {
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
    await extension.context.route("https://pathofexile.com/trade2/history", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: TRADE_HISTORY_FIXTURE,
      })
    );
    await extension.context.route("https://jp.pathofexile.com/trade2/history", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: TRADE_HISTORY_FIXTURE,
      })
    );

    const page = await extension.context.newPage();
    await page.goto(`chrome-extension://${extension.extensionId}/popup.html`);

    await expect(page.locator("#league-select option")).toHaveCount(2);
    await expect(page.locator("#league-select")).toContainText("Fate of the Vaal");

    await page.selectOption("#language-select", "ja");
    await expect(page.locator("[data-i18n='labelLeague']")).toHaveText("リーグ");
  } finally {
    await extension.dispose();
  }
});
