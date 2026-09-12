import { strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { readTradeSearchId } from "../../dist/content/trade-page-adapter.js";

test("trade search ID is read from locale-independent poe2 URLs", () => {
  strictEqual(
    readTradeSearchId("https://jp.pathofexile.com/trade2/search/poe2/Standard/pJgqEMGZC0"),
    "pJgqEMGZC0"
  );
  strictEqual(
    readTradeSearchId("https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/search_1"),
    "search_1"
  );
  strictEqual(readTradeSearchId("https://example.test/trade2/search/poe2/Standard/id"), null);
  strictEqual(
    readTradeSearchId("https://www.pathofexile.com/trade2/search/poe1/Standard/id"),
    null
  );
  strictEqual(
    readTradeSearchId("https://www.pathofexile.com/trade2/search/poe2/Standard/unsafe%2Fid"),
    null
  );
});
