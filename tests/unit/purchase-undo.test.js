import { strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { getUndoProgress, getUndoSecondsRemaining } from "../../dist/purchase/undo.js";

test("undo countdown starts at 30 seconds and decreases to zero", () => {
  strictEqual(getUndoSecondsRemaining(30_000, 0), 30);
  strictEqual(getUndoSecondsRemaining(30_000, 29_001), 1);
  strictEqual(getUndoSecondsRemaining(30_000, 30_000), 0);
  strictEqual(getUndoSecondsRemaining(30_000, 31_000), 0);
});

test("undo progress is a clamped percentage of the thirty-second window", () => {
  strictEqual(getUndoProgress(30_000, 0), 100);
  strictEqual(getUndoProgress(30_000, 15_000), 50);
  strictEqual(getUndoProgress(30_000, 30_000), 0);
  strictEqual(getUndoProgress(30_000, 40_000), 0);
});
