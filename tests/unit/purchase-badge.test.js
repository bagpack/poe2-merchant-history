import { strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { formatBadgeText } from "../../dist/purchase/background-handler.js";

test("formatBadgeText hides zero and caps counts above 99", () => {
  strictEqual(formatBadgeText(0), "");
  strictEqual(formatBadgeText(1), "1");
  strictEqual(formatBadgeText(99), "99");
  strictEqual(formatBadgeText(100), "99+");
});
