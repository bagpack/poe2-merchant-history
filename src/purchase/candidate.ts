import type { ListingSnapshot, PriceSnapshot } from "../injected/types.js";
import type {
  ItemSummary,
  PurchaseCandidateInput,
  PurchaseCandidateMessage,
  PurchaseRecord,
} from "./types.js";

const TRADE_HOSTS = new Set(["pathofexile.com", "www.pathofexile.com", "jp.pathofexile.com"]);

export function parsePurchaseCandidateMessage(value: unknown): PurchaseCandidateMessage | null {
  if (!isRecord(value) || value.type !== "purchase/candidate" || !isCandidate(value.payload)) {
    return null;
  }
  return value as unknown as PurchaseCandidateMessage;
}

export function mergePurchaseCandidate(
  existing: PurchaseRecord | null,
  candidate: PurchaseCandidateInput
): PurchaseRecord {
  const context = readTradeContext(candidate.source.pageUrl);
  const keepPurchased = existing?.status === "purchased";

  return {
    id: existing?.id ?? buildRecordId(context.realm, context.league, candidate.itemId),
    itemId: candidate.itemId,
    realm: context.realm,
    league: context.league,
    language: candidate.source.language,
    rawItem: candidate.rawItem,
    listingSnapshot: candidate.listingSnapshot,
    summary: createItemSummary(candidate.rawItem),
    source: {
      pageUrl: candidate.source.pageUrl,
      fetchUrl: candidate.source.fetchUrl,
      searchId: context.searchId,
    },
    status: keepPurchased ? "purchased" : "pending",
    candidateAt: existing?.candidateAt ?? candidate.candidateAt,
    purchasedAt: keepPurchased ? existing.purchasedAt : null,
    createdAt: existing?.createdAt ?? candidate.candidateAt,
    updatedAt: candidate.candidateAt,
    schemaVersion: 1,
  };
}

export function getPurchaseRecordId(candidate: PurchaseCandidateInput): string {
  const context = readTradeContext(candidate.source.pageUrl);
  return buildRecordId(context.realm, context.league, candidate.itemId);
}

function isCandidate(value: unknown): value is PurchaseCandidateInput {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.itemId) ||
    !isNullableString(value.resultId) ||
    !isRecord(value.rawItem) ||
    value.rawItem.id !== value.itemId ||
    !isListingSnapshot(value.listingSnapshot) ||
    value.listingSnapshot.resultId !== value.resultId ||
    !isSource(value.source) ||
    typeof value.candidateAt !== "number" ||
    !Number.isFinite(value.candidateAt)
  ) {
    return false;
  }
  return true;
}

function isSource(value: unknown): value is PurchaseCandidateInput["source"] {
  return (
    isRecord(value) &&
    isTradeUrl(value.pageUrl, /^\/trade2\/search\//) &&
    isTradeUrl(value.fetchUrl, /^\/api\/trade2\/fetch(?:\/|$)/) &&
    isNullableString(value.language)
  );
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

function isTradeUrl(value: unknown, pathPattern: RegExp): value is string {
  if (typeof value !== "string") {
    return false;
  }
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" && TRADE_HOSTS.has(url.hostname) && pathPattern.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function readTradeContext(pageUrl: string): {
  realm: string | null;
  league: string | null;
  searchId: string | null;
} {
  const segments = new URL(pageUrl).pathname.split("/").filter(Boolean).map(decodeSegment);
  const searchIndex = segments.findIndex((segment) => segment === "search");
  return {
    realm: segments[searchIndex + 1] ?? null,
    league: segments[searchIndex + 2] ?? null,
    searchId: segments[searchIndex + 3] ?? null,
  };
}

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function buildRecordId(realm: string | null, league: string | null, itemId: string): string {
  return `${realm ?? "unknown-realm"}:${league ?? "unknown-league"}:${itemId}`;
}

function createItemSummary(rawItem: Record<string, unknown>): ItemSummary {
  const name = readString(rawItem.name);
  const typeLine = readString(rawItem.typeLine);
  const baseType = readString(rawItem.baseType);
  return {
    displayName:
      name && typeLine ? `${name} ${typeLine}` : (typeLine ?? baseType ?? "Unknown Item"),
    name,
    typeLine,
    baseType,
    rarity: readString(rawItem.rarity),
    itemLevel: readFiniteNumber(rawItem.ilvl),
    iconUrl: readString(rawItem.icon),
  };
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
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
