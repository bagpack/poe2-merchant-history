export type PurchaseHistoryMessage =
  | { type: "purchase/list" }
  | { type: "purchase/mark-purchased"; id: string }
  | { type: "purchase/delete"; id: string }
  | { type: "purchase/undo"; token: string }
  | { type: "purchase/undo-current" }
  | { type: "purchase/delete-all" };

export type PurchaseHistoryChangedMessage = {
  type: "purchase/changed";
  undoToken?: string;
};

export function parsePurchaseHistoryMessage(value: unknown): PurchaseHistoryMessage | null {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null;
  }
  if (
    value.type === "purchase/list" ||
    value.type === "purchase/undo-current" ||
    value.type === "purchase/delete-all"
  ) {
    return { type: value.type };
  }
  if (value.type === "purchase/undo" && isNonEmptyString(value.token)) {
    return { type: value.type, token: value.token };
  }
  if (
    (value.type === "purchase/mark-purchased" || value.type === "purchase/delete") &&
    isNonEmptyString(value.id)
  ) {
    return { type: value.type, id: value.id };
  }
  return null;
}

export function isPurchaseHistoryChangedMessage(
  value: unknown
): value is PurchaseHistoryChangedMessage {
  return (
    isRecord(value) &&
    value.type === "purchase/changed" &&
    (value.undoToken === undefined || isNonEmptyString(value.undoToken))
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
