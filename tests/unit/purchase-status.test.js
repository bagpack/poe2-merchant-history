import { strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { markPurchaseAsPurchased } from "../../dist/purchase/status.js";

const pendingRecord = {
  id: "poe2:Standard:item-1",
  status: "pending",
  purchasedAt: null,
  updatedAt: 1_000,
};

test("manual purchased confirmation resolves a pending record", () => {
  const updated = markPurchaseAsPurchased(pendingRecord, 2_000);

  strictEqual(updated?.status, "purchased");
  strictEqual(updated?.purchasedAt, 2_000);
  strictEqual(updated?.updatedAt, 2_000);
});

test("manual purchase confirmation is not applied twice", () => {
  const purchased = {
    ...pendingRecord,
    status: "purchased",
    purchasedAt: 1_500,
  };

  strictEqual(markPurchaseAsPurchased(purchased, 2_000), null);
});
