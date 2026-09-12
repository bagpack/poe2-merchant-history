import { match, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { buildPurchaseCsv } from "../../dist/purchase/export.js";

test("purchase CSV exports stable columns and escapes spreadsheet values", () => {
  const csv = buildPurchaseCsv([
    {
      status: "pending",
      candidateAt: 1_000,
      purchasedAt: null,
      summary: {
        displayName: 'Name, "quoted"',
        baseType: "Ring",
        itemLevel: 82,
      },
      listingSnapshot: {
        price: { amount: 3, currency: "divine" },
        sellerAccount: "seller",
      },
      league: "Standard",
      itemId: "item-1",
      source: { pageUrl: "https://example.test/search" },
    },
  ]);

  match(csv, /^status,candidate_at,purchased_at,item_name,/);
  match(csv, /"Name, ""quoted"""/);
  match(csv, /pending,1970-01-01T00:00:01.000Z,/);
  strictEqual(csv.includes("confirmation_source"), false);
  strictEqual(csv.includes("attempt_count"), false);
  strictEqual(csv.endsWith("\n"), true);
});
