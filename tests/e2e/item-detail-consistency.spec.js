import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { launchExtensionContext } from "./extension-test-utils.js";

const fixture = JSON.parse(
  await readFile(new URL("../fixtures/trade-search-response.json", import.meta.url), "utf8")
);

const STYLE_PROPERTIES = [
  "backgroundColor",
  "borderBottomColor",
  "borderBottomStyle",
  "borderBottomWidth",
  "borderLeftColor",
  "borderLeftStyle",
  "borderLeftWidth",
  "borderRadius",
  "borderRightColor",
  "borderRightStyle",
  "borderRightWidth",
  "borderTopColor",
  "borderTopStyle",
  "borderTopWidth",
  "boxShadow",
  "color",
  "display",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "gap",
  "height",
  "lineHeight",
  "margin",
  "padding",
  "position",
  "textAlign",
  "width",
];

test("sales and purchase histories render identical item details", async () => {
  const extension = await launchExtensionContext();

  try {
    await extension.context.route("https://pathofexile.com/api/trade2/data/leagues", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        json: { result: [{ id: "Standard", realm: "poe2", text: "Standard" }] },
      })
    );
    const item = {
      ...structuredClone(fixture.result[0].item),
      league: "Standard",
      explicitMods: [
        { description: "+25 to maximum Life", flags: { fractured: true } },
        { description: "6% increased Elemental Damage", flags: { desecrated: true } },
        "+18% to Fire Resistance",
      ],
      desecrated: true,
      desecratedMods: [],
      corrupted: true,
    };
    const setupPage = await extension.context.newPage();
    await setupPage.goto(`chrome-extension://${extension.extensionId}/options.html`);
    await setupPage.evaluate(async (rawItem) => {
      await chrome.storage.local.set({
        uiLanguage: "ja",
        leagueId: "Standard",
        legacyDbMigrated_Standard: true,
      });
      await new Promise((resolve, reject) => {
        const request = indexedDB.open("poe2-trade-history-ja-Standard", 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("trade_history", { keyPath: "id" });
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("trade_history", "readwrite");
          tx.objectStore("trade_history").put({
            id: rawItem.id,
            item_name: rawItem.typeLine,
            currency: "exalted",
            amount: 1,
            time: "2026-08-10T12:00:00Z",
            details_json: rawItem,
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      });
    }, item);
    const purchaseResponse = await setupPage.evaluate(
      ({ rawItem, resultId }) =>
        chrome.runtime.sendMessage({
          type: "purchase/candidate",
          payload: {
            itemId: rawItem.id,
            resultId,
            rawItem,
            listingSnapshot: {
              resultId,
              price: { amount: 1, currency: "exalted", type: "~price" },
              sellerAccount: "seller-account",
              indexedAt: "2026-08-10T12:00:00Z",
            },
            source: {
              pageUrl: "https://www.pathofexile.com/trade2/search/poe2/Standard/search-1",
              fetchUrl: "https://www.pathofexile.com/api/trade2/fetch/item-1",
              language: "en",
            },
            candidateAt: 1_000,
          },
        }),
      { rawItem: item, resultId: fixture.result[0].id }
    );
    expect(purchaseResponse.ok).toBe(true);
    await setupPage.close();

    const salesPage = await extension.context.newPage();
    await salesPage.goto(`chrome-extension://${extension.extensionId}/popup.html`);
    const salesTrigger = salesPage.getByRole("button", { name: "Sapphire Ring" });
    await salesTrigger.hover();
    await salesTrigger.focus();
    await expect(salesTrigger).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await salesTrigger.click();
    const salesDetail = await detailSnapshot(salesPage);

    const purchasePage = await extension.context.newPage();
    await purchasePage.goto(`chrome-extension://${extension.extensionId}/purchase-history.html`);
    const purchaseTrigger = purchasePage.getByRole("button", { name: "Sapphire Ring" });
    await purchaseTrigger.hover();
    await purchaseTrigger.focus();
    await expect(purchaseTrigger).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await purchaseTrigger.click();
    const purchaseDetail = await detailSnapshot(purchasePage);

    expect(purchaseDetail).toEqual(salesDetail);
    await expect(
      purchasePage.locator(".item-line-desecrated", {
        hasText: "6% increased Elemental Damage",
      })
    ).toHaveCSS("color", "rgb(0, 187, 127)");
    await expect(
      purchasePage.locator(".item-line-desecrated", {
        hasText: "6% increased Elemental Damage",
      })
    ).toHaveAttribute("aria-label", "冒涜されたMod: 6% increased Elemental Damage");
    await expect(
      purchasePage.locator(".item-line-desecrated-label", { hasText: "冒涜されたMod" })
    ).toHaveCSS("color", "rgb(173, 52, 64)");
    await expect(purchasePage.locator("#detail-body")).toContainText("アイテムレベル:");
    await expect(purchasePage.locator("#detail-body")).not.toContainText("Item Level:");
    await expect(purchasePage.locator(".item-line-corrupted")).toHaveCSS(
      "color",
      "rgb(173, 52, 64)"
    );
  } finally {
    await extension.dispose();
  }
});

async function detailSnapshot(page) {
  return page.locator("#detail-card").evaluate(
    (card, properties) =>
      [card, ...card.querySelectorAll("*")].map((element) => {
        const style = getComputedStyle(element);
        return {
          tag: element.tagName,
          className: element.className,
          text: element.textContent,
          styles: Object.fromEntries(properties.map((property) => [property, style[property]])),
        };
      }),
    STYLE_PROPERTIES
  );
}
