import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { launchExtensionContext } from "./extension-test-utils.js";

const FIRST_ITEM_ID = "c".repeat(64);
const FIRST_RESULT_ID = "d".repeat(64);
const SECOND_ITEM_ID = "e".repeat(64);
const SECOND_RESULT_ID = "f".repeat(64);
const FIRST_RESPONSE = JSON.parse(
  await readFile(new URL("../fixtures/trade-search-response.json", import.meta.url), "utf8")
);
FIRST_RESPONSE.result[0].id = FIRST_RESULT_ID;
FIRST_RESPONSE.result[0].item.id = FIRST_ITEM_ID;
const SECOND_RESPONSE = structuredClone(FIRST_RESPONSE);
SECOND_RESPONSE.result[0].id = SECOND_RESULT_ID;
SECOND_RESPONSE.result[0].item.id = SECOND_ITEM_ID;
const RECOVERED_ITEM_ID = "a".repeat(64);
const RECOVERY_SEARCH_ID = "recoverySearch1";
const RECOVERY_RESPONSE = structuredClone(FIRST_RESPONSE);
RECOVERY_RESPONSE.result[0].id = RECOVERED_ITEM_ID;
RECOVERY_RESPONSE.result[0].item.id = RECOVERED_ITEM_ID;

test("language-independent trade controls save only clicked instant-buyout items", async () => {
  const extension = await launchExtensionContext();

  try {
    await extension.context.route(
      "https://www.pathofexile.com/trade2/search/poe2/Standard/test",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/html",
          body: `
          <div class="row" data-id="${FIRST_RESULT_ID}">
            <span data-field="fee">100</span>
            <button id="immediate" class="direct-btn">arbitrary locale text</button>
          </div>
          <div class="row" data-id="${SECOND_ITEM_ID}">
            <span data-field="fee">200</span>
            <button id="delayed" class="direct-btn">別言語の任意文言</button>
          </div>
          <div class="row" data-id="${FIRST_RESULT_ID}">
            <button id="ordinary-whisper" class="direct-btn">arbitrary locale text</button>
          </div>
          <div class="row" data-id="never-clicked">
            <span data-field="fee">300</span>
            <button class="direct-btn">arbitrary locale text</button>
          </div>
        `,
        })
    );
    await extension.context.route(
      new RegExp(`https://www\\.pathofexile\\.com/api/trade2/fetch/${FIRST_RESULT_ID}\\?.+`),
      (route) =>
        route.fulfill({ status: 200, contentType: "application/json", json: FIRST_RESPONSE })
    );
    await extension.context.route(
      new RegExp(`https://www\\.pathofexile\\.com/api/trade2/fetch/${SECOND_ITEM_ID}\\?.+`),
      (route) =>
        route.fulfill({ status: 200, contentType: "application/json", json: SECOND_RESPONSE })
    );

    const extensionPage = await extension.context.newPage();
    await extensionPage.goto(`chrome-extension://${extension.extensionId}/popup.html`);
    await expect(extensionPage.locator("#purchase-pending-count")).toHaveText("0");

    const tradePage = await extension.context.newPage();
    await tradePage.goto("https://www.pathofexile.com/trade2/search/poe2/Standard/test");
    await tradePage.locator("#ordinary-whisper").click();
    await tradePage.evaluate(() => document.querySelector("#immediate").click());
    await tradePage.locator("#immediate").click();
    await tradePage.locator("#delayed").click();

    await expect
      .poll(() => extensionPage.evaluate(() => chrome.action.getBadgeText({})), { timeout: 5_000 })
      .toBe("2");
    await expect(extensionPage.locator("#purchase-pending-count")).toHaveText("2");
    await expect(extensionPage.locator("#purchase-pending-list")).toContainText("Sapphire Ring");
    const records = await extensionPage.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const request = indexedDB.open("poe2-purchase-history");
          request.onsuccess = () => {
            const db = request.result;
            const getAll = db
              .transaction("purchases", "readonly")
              .objectStore("purchases")
              .getAll();
            getAll.onsuccess = () => resolve(getAll.result);
            getAll.onerror = () => reject(getAll.error);
          };
          request.onerror = () => reject(request.error);
        })
    );

    expect(records).toHaveLength(2);
    expect(records.map((record) => record.itemId).sort()).toEqual(
      [FIRST_ITEM_ID, SECOND_ITEM_ID].sort()
    );
    expect(records.every((record) => record.status === "pending")).toBe(true);
    expect(records.every((record) => !("attemptCount" in record))).toBe(true);
    expect(records[0].rawItem.futureFieldAddedByGGG).toEqual({
      value: 123,
      nested: ["a", "b"],
    });
  } finally {
    await extension.dispose();
  }
});

test("a competing capture listener cannot hide an instant-buyout click", async () => {
  const extension = await launchExtensionContext();

  try {
    await extension.context.route(
      "https://www.pathofexile.com/trade2/search/poe2/Standard/competing-extension",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/html",
          body: `
            <div class="row" data-id="${FIRST_RESULT_ID}">
              <span data-field="fee">100</span>
              <button id="intercepted" class="direct-btn">Instant purchase</button>
            </div>
          `,
        })
    );
    await extension.context.route(
      new RegExp(`https://www\\.pathofexile\\.com/api/trade2/fetch/${FIRST_RESULT_ID}\\?.+`),
      (route) =>
        route.fulfill({ status: 200, contentType: "application/json", json: FIRST_RESPONSE })
    );

    const tradePage = await extension.context.newPage();
    await tradePage.goto(
      "https://www.pathofexile.com/trade2/search/poe2/Standard/competing-extension"
    );
    await tradePage.evaluate(() => {
      window.addEventListener(
        "click",
        (event) => {
          if (event.target instanceof Element && event.target.closest("#intercepted")) {
            event.stopImmediatePropagation();
          }
        },
        true
      );
    });
    await tradePage.locator("#intercepted").click();

    const extensionPage = await extension.context.newPage();
    await extensionPage.goto(`chrome-extension://${extension.extensionId}/popup.html`);
    await expect(extensionPage.locator("#purchase-pending-count")).toHaveText("1");
  } finally {
    await extension.dispose();
  }
});

test("a trusted click recovers the item when the search response was missed", async () => {
  const extension = await launchExtensionContext();

  try {
    await extension.context.route(
      `https://jp.pathofexile.com/trade2/search/poe2/Standard/${RECOVERY_SEARCH_ID}`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/html",
          body: `
            <script>
              window.addEventListener("message", (event) => {
                if (event.data?.channel === "poe2-purchase-history/network/v1") {
                  event.data.payload = undefined;
                }
              });
              const competingFrame = document.createElement("iframe");
              document.documentElement.append(competingFrame);
              window.fetch = competingFrame.contentWindow.fetch.bind(competingFrame.contentWindow);
            </script>
            <div class="row" data-id="${RECOVERED_ITEM_ID}">
              <span data-field="fee">100</span>
              <button id="recover" class="direct-btn">隠れ家に移動する</button>
            </div>
            <script>
              document.querySelector("#recover").addEventListener("click", () => {
                const xhr = new XMLHttpRequest();
                xhr.open("POST", "/api/trade2/whisper");
                xhr.setRequestHeader("content-type", "application/json");
                xhr.send(JSON.stringify({ token: "synthetic-token-must-not-be-stored" }));
              });
            </script>
          `,
        })
    );
    await extension.context.route("https://jp.pathofexile.com/api/trade2/whisper", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", json: { success: true } })
    );
    await extension.context.route(
      new RegExp(`https://jp\\.pathofexile\\.com/api/trade2/fetch/${RECOVERED_ITEM_ID}\\?.+`),
      (route) => {
        const url = new URL(route.request().url());
        expect(url.searchParams.get("query")).toBe(RECOVERY_SEARCH_ID);
        expect(url.searchParams.get("realm")).toBe("poe2");
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          json: RECOVERY_RESPONSE,
        });
      }
    );

    const tradePage = await extension.context.newPage();
    const pageErrors = [];
    tradePage.on("pageerror", (error) => pageErrors.push(error.message));
    await tradePage.goto(
      `https://jp.pathofexile.com/trade2/search/poe2/Standard/${RECOVERY_SEARCH_ID}`
    );
    const recoverButton = await tradePage.locator("#recover").boundingBox();
    expect(recoverButton).not.toBeNull();
    await tradePage.mouse.click(
      recoverButton.x + recoverButton.width / 2,
      recoverButton.y + recoverButton.height / 2
    );

    const extensionPage = await extension.context.newPage();
    await extensionPage.goto(`chrome-extension://${extension.extensionId}/popup.html`);
    await expect
      .poll(() => extensionPage.evaluate(() => chrome.action.getBadgeText({})), { timeout: 5_000 })
      .toBe("1");

    const persisted = await extensionPage.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const request = indexedDB.open("poe2-purchase-history");
          request.onsuccess = () => {
            const db = request.result;
            const getAll = db
              .transaction("purchases", "readonly")
              .objectStore("purchases")
              .getAll();
            getAll.onsuccess = async () =>
              resolve({ purchases: getAll.result, storage: await chrome.storage.local.get(null) });
            getAll.onerror = () => reject(getAll.error);
          };
          request.onerror = () => reject(request.error);
        })
    );

    expect(persisted.purchases).toHaveLength(1);
    expect(persisted.purchases[0].itemId).toBe(RECOVERED_ITEM_ID);
    expect(persisted.purchases[0].status).toBe("pending");
    expect(JSON.stringify(persisted)).not.toContain("synthetic-token-must-not-be-stored");
    await tradePage.waitForTimeout(50);
    expect(pageErrors).toEqual([]);
  } finally {
    await extension.dispose();
  }
});
