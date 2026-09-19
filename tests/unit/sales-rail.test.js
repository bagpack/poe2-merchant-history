import assert from "node:assert/strict";
import test from "node:test";

import { buildDailySales } from "../../dist/popup/chart-service.js";
import { getCurrencyIcon } from "../../dist/popup/formatters.js";

test("daily sales are newest first and keep counts separate from currency totals", () => {
  const days = buildDailySales([
    { id: "1", time: "2026-09-18T10:00:00", currency: "divine", amount: 2 },
    { id: "2", time: "2026-09-18T11:00:00", currency: "exalted", amount: 12_345 },
    { id: "4", time: "2026-09-18T12:00:00", currency: "chaos", amount: 9_876 },
    { id: "5", time: "2026-09-18T13:00:00", currency: "annul", amount: 10_250 },
    { id: "3", time: "2026-09-19T10:00:00", currency: "divine", amount: 3 },
  ]);

  assert.deepEqual(
    days.map(({ date, saleCount, totals }) => [date, saleCount, Object.fromEntries(totals)]),
    [
      ["2026-09-19", 1, { divine: 3 }],
      ["2026-09-18", 4, { divine: 2, exalted: 12_345, chaos: 9_876, annul: 10_250 }],
    ]
  );
});

test("known currencies use bundled icons and unknown currencies fall back to text", () => {
  assert.equal(getCurrencyIcon("divine"), "assets/currency/CurrencyModValues.png");
  assert.equal(getCurrencyIcon("custom-currency"), null);
});
