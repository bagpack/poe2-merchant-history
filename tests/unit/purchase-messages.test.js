import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { test } from "node:test";
import {
  isPurchaseHistoryChangedMessage,
  parsePurchaseHistoryMessage,
} from "../../dist/purchase/messages.js";

test("purchase history message parser accepts supported operations", () => {
  deepStrictEqual(parsePurchaseHistoryMessage({ type: "purchase/list" }), {
    type: "purchase/list",
  });
  deepStrictEqual(
    parsePurchaseHistoryMessage({
      type: "purchase/mark-purchased",
      id: "poe2:Standard:item-1",
    }),
    {
      type: "purchase/mark-purchased",
      id: "poe2:Standard:item-1",
    }
  );
  deepStrictEqual(parsePurchaseHistoryMessage({ type: "purchase/undo", token: "undo-token" }), {
    type: "purchase/undo",
    token: "undo-token",
  });
  deepStrictEqual(parsePurchaseHistoryMessage({ type: "purchase/undo-current" }), {
    type: "purchase/undo-current",
  });
});

test("purchase history message parser rejects old status updates and missing IDs", () => {
  strictEqual(
    parsePurchaseHistoryMessage({
      type: "purchase/update-status",
      id: "poe2:Standard:item-1",
      status: "purchased",
    }),
    null
  );
  strictEqual(parsePurchaseHistoryMessage({ type: "purchase/mark-purchased", id: "" }), null);
  strictEqual(parsePurchaseHistoryMessage({ type: "purchase/delete", id: "" }), null);
  strictEqual(parsePurchaseHistoryMessage({ type: "purchase/undo", token: "" }), null);
});

test("purchase history change event is separate from command messages", () => {
  strictEqual(isPurchaseHistoryChangedMessage({ type: "purchase/changed" }), true);
  strictEqual(
    isPurchaseHistoryChangedMessage({ type: "purchase/changed", undoToken: "token" }),
    true
  );
  strictEqual(isPurchaseHistoryChangedMessage({ type: "purchase/changed", undoToken: "" }), false);
  strictEqual(isPurchaseHistoryChangedMessage({ type: "purchase/list" }), false);
  strictEqual(parsePurchaseHistoryMessage({ type: "purchase/changed" }), null);
});
