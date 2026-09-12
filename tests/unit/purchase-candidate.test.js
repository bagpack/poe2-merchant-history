import { readFile } from "node:fs/promises";
import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import {
  mergePurchaseCandidate,
  parsePurchaseCandidateMessage,
} from "../../dist/purchase/candidate.js";
import { parseSearchResponse } from "../../dist/injected/trade-api-adapter.js";

const fixture = JSON.parse(
  await readFile(new URL("../fixtures/trade-search-response.json", import.meta.url), "utf8")
);
const [capturedItem] = parseSearchResponse(fixture, {
  fetchUrl: "https://www.pathofexile.com/api/trade2/fetch/item-1",
  capturedAt: 123,
});

const message = {
  type: "purchase/candidate",
  payload: {
    itemId: capturedItem.itemId,
    resultId: capturedItem.resultId,
    rawItem: capturedItem.rawItem,
    listingSnapshot: capturedItem.listingSnapshot,
    source: {
      pageUrl: "https://www.pathofexile.com/trade2/search/poe2/Standard/search-1",
      fetchUrl: capturedItem.fetchUrl,
      language: "en",
    },
    candidateAt: 1_000,
  },
};

test("parsePurchaseCandidateMessage accepts a valid candidate", () => {
  deepStrictEqual(parsePurchaseCandidateMessage(message), message);
});

test("parsePurchaseCandidateMessage rejects a mismatched raw item ID", () => {
  strictEqual(
    parsePurchaseCandidateMessage({
      ...message,
      payload: {
        ...message.payload,
        rawItem: { ...message.payload.rawItem, id: "other-item" },
      },
    }),
    null
  );
});

test("mergePurchaseCandidate creates one pending record without dropping unknown item fields", () => {
  const record = mergePurchaseCandidate(null, message.payload);

  strictEqual(record.id, "poe2:Standard:item-1");
  strictEqual(record.status, "pending");
  strictEqual("attemptCount" in record, false);
  strictEqual("attempts" in record, false);
  strictEqual("events" in record, false);
  deepStrictEqual(record.rawItem.futureFieldAddedByGGG, { value: 123, nested: ["a", "b"] });
  strictEqual(record.summary.displayName, "Sapphire Ring");
  strictEqual(record.source.searchId, "search-1");
  strictEqual(record.schemaVersion, 1);
});

test("mergePurchaseCandidate updates the same record when clicked again", () => {
  const first = mergePurchaseCandidate(null, message.payload);
  const second = mergePurchaseCandidate(first, { ...message.payload, candidateAt: 2_000 });

  strictEqual(second.id, first.id);
  strictEqual(second.createdAt, 1_000);
  strictEqual(second.updatedAt, 2_000);
});

test("mergePurchaseCandidate does not move a purchased record back to pending", () => {
  const first = mergePurchaseCandidate(null, message.payload);
  const purchased = {
    ...first,
    status: "purchased",
    purchasedAt: 1_500,
  };
  const updated = mergePurchaseCandidate(purchased, {
    ...message.payload,
    candidateAt: 2_000,
  });

  strictEqual(updated.status, "purchased");
  strictEqual(updated.purchasedAt, 1_500);
});
