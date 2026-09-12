import type { PurchaseRecord } from "./types.js";

export function markPurchaseAsPurchased(
  record: PurchaseRecord,
  occurredAt = Date.now()
): PurchaseRecord | null {
  if (record.status === "purchased") {
    return null;
  }

  return {
    ...record,
    status: "purchased",
    purchasedAt: occurredAt,
    updatedAt: occurredAt,
  };
}
