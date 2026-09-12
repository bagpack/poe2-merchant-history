import type {
  CapturedItem,
  ListingSnapshot,
  NetworkItemBatchMessage,
  PriceSnapshot,
} from "../injected/types.js";

const NETWORK_CHANNEL = "poe2-purchase-history/network/v1" as const;

export function parseNetworkItemBatchMessage(value: unknown): NetworkItemBatchMessage | null {
  const message = parseSerializedMessage(value);
  if (
    !isRecord(message) ||
    message.channel !== NETWORK_CHANNEL ||
    message.type !== "ITEM_BATCH" ||
    !Array.isArray(message.payload) ||
    !message.payload.every(isCapturedItem)
  ) {
    return null;
  }

  return message as unknown as NetworkItemBatchMessage;
}

function parseSerializedMessage(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isCapturedItem(value: unknown): value is CapturedItem {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.itemId) ||
    !isNullableString(value.resultId) ||
    !isRecord(value.rawItem) ||
    value.rawItem.id !== value.itemId ||
    !isListingSnapshot(value.listingSnapshot) ||
    !isNonEmptyString(value.fetchUrl) ||
    typeof value.capturedAt !== "number" ||
    !Number.isFinite(value.capturedAt)
  ) {
    return false;
  }

  return true;
}

function isListingSnapshot(value: unknown): value is ListingSnapshot {
  return (
    isRecord(value) &&
    isNullableString(value.resultId) &&
    (value.price === null || isPriceSnapshot(value.price)) &&
    isNullableString(value.sellerAccount) &&
    isNullableString(value.indexedAt)
  );
}

function isPriceSnapshot(value: unknown): value is PriceSnapshot {
  return (
    isRecord(value) &&
    typeof value.amount === "number" &&
    Number.isFinite(value.amount) &&
    isNonEmptyString(value.currency) &&
    isNullableString(value.type)
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
