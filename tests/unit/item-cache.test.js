import { readFile } from "node:fs/promises";
import { strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { ItemCache } from "../../dist/content/item-cache.js";
import { parseSearchResponse } from "../../dist/injected/trade-api-adapter.js";

const fixture = JSON.parse(
  await readFile(new URL("../fixtures/trade-search-response.json", import.meta.url), "utf8")
);
const [capturedItem] = parseSearchResponse(fixture, {
  fetchUrl: "https://www.pathofexile.com/api/trade2/fetch/item-1",
  capturedAt: 123,
});

function item(itemId, resultId) {
  return {
    ...capturedItem,
    itemId,
    resultId,
    rawItem: { ...capturedItem.rawItem, id: itemId },
    listingSnapshot: { ...capturedItem.listingSnapshot, resultId },
  };
}

test("ItemCache resolves captured items by item ID and result ID", () => {
  const cache = new ItemCache();
  cache.putBatch([capturedItem]);

  strictEqual(cache.getByItemId("item-1"), capturedItem);
  strictEqual(cache.getByResultId("listing-result-1"), capturedItem);
  strictEqual(cache.size, 1);
});

test("ItemCache replaces an item without leaving an old result ID mapping", () => {
  const cache = new ItemCache();
  const latest = item("item-1", "listing-result-2");

  cache.putBatch([capturedItem]);
  cache.putBatch([latest]);

  strictEqual(cache.getByResultId("listing-result-1"), null);
  strictEqual(cache.getByResultId("listing-result-2"), latest);
  strictEqual(cache.size, 1);
});

test("ItemCache evicts the oldest item when its size limit is exceeded", () => {
  const cache = new ItemCache(2);
  cache.putBatch([item("item-1", "result-1"), item("item-2", "result-2")]);
  cache.putBatch([item("item-3", "result-3")]);

  strictEqual(cache.getByItemId("item-1"), null);
  strictEqual(cache.getByItemId("item-2")?.itemId, "item-2");
  strictEqual(cache.getByItemId("item-3")?.itemId, "item-3");
});

test("ItemCache does not return entries after the TTL expires", () => {
  let now = 1_000;
  const cache = new ItemCache(2, 100, () => now);
  cache.putBatch([capturedItem]);
  now = 1_100;

  strictEqual(cache.getByItemId("item-1"), null);
  strictEqual(cache.getByResultId("listing-result-1"), null);
  strictEqual(cache.size, 0);
});
