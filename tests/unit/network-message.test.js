import { readFile } from "node:fs/promises";
import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { parseNetworkItemBatchMessage } from "../../dist/content/network-message.js";
import { parseSearchResponse } from "../../dist/injected/trade-api-adapter.js";

const fixture = JSON.parse(
  await readFile(new URL("../fixtures/trade-search-response.json", import.meta.url), "utf8")
);
const [capturedItem] = parseSearchResponse(fixture, {
  fetchUrl: "https://www.pathofexile.com/api/trade2/fetch/item-1",
  capturedAt: 123,
});

test("parseNetworkItemBatchMessage accepts a valid item batch", () => {
  const message = {
    channel: "poe2-purchase-history/network/v1",
    type: "ITEM_BATCH",
    payload: [capturedItem],
  };

  deepStrictEqual(parseNetworkItemBatchMessage(message), message);
  deepStrictEqual(parseNetworkItemBatchMessage(JSON.stringify(message)), message);
  strictEqual(parseNetworkItemBatchMessage("not-json"), null);
});

test("parseNetworkItemBatchMessage rejects unknown channels and message types", () => {
  strictEqual(
    parseNetworkItemBatchMessage({ channel: "unknown", type: "ITEM_BATCH", payload: [] }),
    null
  );
  strictEqual(
    parseNetworkItemBatchMessage({
      channel: "poe2-purchase-history/network/v1",
      type: "PURCHASE_OUTCOME",
      payload: [],
    }),
    null
  );
});

test("parseNetworkItemBatchMessage rejects mismatched raw item IDs", () => {
  const invalidItem = {
    ...capturedItem,
    rawItem: { ...capturedItem.rawItem, id: "different-item" },
  };

  strictEqual(
    parseNetworkItemBatchMessage({
      channel: "poe2-purchase-history/network/v1",
      type: "ITEM_BATCH",
      payload: [invalidItem],
    }),
    null
  );
});
