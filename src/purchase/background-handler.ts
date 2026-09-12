import { parsePurchaseCandidateMessage } from "./candidate.js";
import type { PurchaseHistoryMessage } from "./messages.js";
import { PurchaseRepository } from "./repository.js";

const repository = new PurchaseRepository();

export function isPurchaseCandidateMessage(message: unknown): boolean {
  return parsePurchaseCandidateMessage(message) !== null;
}

export async function savePurchaseCandidate(message: unknown) {
  const candidate = parsePurchaseCandidateMessage(message);
  if (!candidate) {
    throw new Error("INVALID_PURCHASE_CANDIDATE");
  }

  const record = await repository.upsertCandidate(candidate.payload);
  await updateBadge();
  return record;
}

export async function handlePurchaseHistoryMessage(message: PurchaseHistoryMessage) {
  if (message.type === "purchase/list") {
    return repository.list();
  }
  if (message.type === "purchase/undo-current") {
    return repository.latestUndo();
  }
  if (message.type === "purchase/mark-purchased") {
    const result = await repository.markPurchased(message.id);
    if (!result) {
      throw new Error("PURCHASE_STATUS_UPDATE_REJECTED");
    }
    await updateBadge();
    return result;
  }
  if (message.type === "purchase/delete") {
    const result = await repository.delete(message.id);
    if (!result) {
      throw new Error("PURCHASE_DELETE_REJECTED");
    }
    await updateBadge();
    return result;
  }
  if (message.type === "purchase/undo") {
    const result = await repository.undo(message.token);
    if (!result) {
      throw new Error("PURCHASE_UNDO_EXPIRED");
    }
    await updateBadge();
    return result;
  }
  await repository.deleteAll();
  await updateBadge();
  return null;
}

async function updateBadge(): Promise<void> {
  const pendingCount = await repository.countPending();
  await chrome.action.setBadgeText({ text: formatBadgeText(pendingCount) });
}

export function formatBadgeText(pendingCount: number): string {
  if (pendingCount === 0) {
    return "";
  }
  return pendingCount > 99 ? "99+" : String(pendingCount);
}
