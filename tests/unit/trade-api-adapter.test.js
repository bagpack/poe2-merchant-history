import { readFile } from "node:fs/promises";
import { deepStrictEqual, notStrictEqual, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { isSearchFetchUrl, parseSearchResponse } from "../../dist/injected/trade-api-adapter.js";

const fixture = JSON.parse(
  await readFile(new URL("../fixtures/trade-search-response.json", import.meta.url), "utf8")
);

test("parseSearchResponse keeps the complete raw item and safe listing fields", () => {
  const capturedItems = parseSearchResponse(fixture, {
    fetchUrl: "https://www.pathofexile.com/api/trade2/fetch/item-1?query=query-id",
    capturedAt: 123,
  });

  strictEqual(capturedItems.length, 1);
  strictEqual(capturedItems[0].itemId, "item-1");
  strictEqual(capturedItems[0].resultId, "listing-result-1");
  deepStrictEqual(capturedItems[0].rawItem, fixture.result[0].item);
  notStrictEqual(capturedItems[0].rawItem, fixture.result[0].item);
  deepStrictEqual(capturedItems[0].listingSnapshot, {
    resultId: "listing-result-1",
    price: { amount: 1, currency: "exalted", type: "~price" },
    sellerAccount: "seller-account",
    indexedAt: "2026-08-10T12:00:00Z",
  });
});

test("parseSearchResponse ignores malformed results without failing the batch", () => {
  const capturedItems = parseSearchResponse(
    { result: [{ item: null }, { item: { id: "" } }, { item: { id: 42 } }] },
    { fetchUrl: "https://www.pathofexile.com/api/trade2/fetch/", capturedAt: 123 }
  );

  deepStrictEqual(capturedItems, []);
});

test("isSearchFetchUrl only accepts trade2 fetch responses", () => {
  strictEqual(isSearchFetchUrl("https://www.pathofexile.com/api/trade2/fetch/item-1"), true);
  strictEqual(isSearchFetchUrl("https://jp.pathofexile.com/api/trade2/fetch/item-1"), true);
  strictEqual(isSearchFetchUrl("https://www.pathofexile.com/api/trade2/history/Standard"), false);
  strictEqual(isSearchFetchUrl("https://www.pathofexile.com/api/trade2/search/poe2"), false);
});

test("parseSearchResponse returns an empty list for a malformed response", () => {
  deepStrictEqual(
    parseSearchResponse(null, {
      fetchUrl: "https://www.pathofexile.com/api/trade2/fetch/",
      capturedAt: 123,
    }),
    []
  );
});
