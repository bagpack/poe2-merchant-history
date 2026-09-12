import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { parsePurchaseHistoryFilterPreferences } from "../../dist/purchase/filter-preferences.js";

test("purchase history filter preferences accept supported values", () => {
  deepStrictEqual(
    parsePurchaseHistoryFilterPreferences({
      status: "pending",
      itemName: "Sapphire",
      league: "Standard",
      dateFrom: "1970-01-01",
      dateTo: "1970-01-02",
    }),
    {
      status: "pending",
      itemName: "Sapphire",
      league: "Standard",
      dateFrom: "1970-01-01",
      dateTo: "1970-01-02",
    }
  );
});

test("purchase history filter preferences discard invalid persisted values", () => {
  deepStrictEqual(parsePurchaseHistoryFilterPreferences({ status: "archived" }), {
    status: "",
    itemName: "",
    league: "",
    dateFrom: "",
    dateTo: "",
  });
  strictEqual(parsePurchaseHistoryFilterPreferences({ dateFrom: "not-a-date" }).dateFrom, "");
});
