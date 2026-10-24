import type { PurchaseUndoAction } from "./types.js";

export const PURCHASE_UNDO_WINDOW_MS = 30_000;

export function getUndoSecondsRemaining(expiresAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}

export function getUndoProgress(expiresAt: number, now = Date.now()): number {
  const elapsed = PURCHASE_UNDO_WINDOW_MS - (expiresAt - now);
  return Math.max(0, Math.min(100, (1 - elapsed / PURCHASE_UNDO_WINDOW_MS) * 100));
}

export function isUndoInvalidatedByCandidate(
  undo: Pick<PurchaseUndoAction, "recordId"> | null,
  recordId: string
): boolean {
  return undo !== null && undo.recordId === recordId;
}
