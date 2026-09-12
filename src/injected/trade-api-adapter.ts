import type {
  ApiContext,
  CapturedItem,
  JsonObject,
  ListingSnapshot,
  PriceSnapshot,
} from "./types.js";

const TRADE_HOSTS = new Set(["pathofexile.com", "www.pathofexile.com", "jp.pathofexile.com"]);
const SEARCH_FETCH_PATH = /^\/api\/trade2\/fetch(?:\/|$)/;

export function isSearchFetchUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url, "https://pathofexile.com");
    return TRADE_HOSTS.has(parsedUrl.hostname) && SEARCH_FETCH_PATH.test(parsedUrl.pathname);
  } catch {
    return false;
  }
}

export function parseSearchResponse(body: unknown, context: ApiContext): CapturedItem[] {
  if (!isRecord(body) || !Array.isArray(body.result)) {
    return [];
  }

  return body.result.flatMap((entry) => parseCapturedItem(entry, context));
}

function parseCapturedItem(entry: unknown, context: ApiContext): CapturedItem[] {
  if (!isRecord(entry) || !isRecord(entry.item)) {
    return [];
  }

  const itemId = readNonEmptyString(entry.item.id);
  if (!itemId) {
    return [];
  }

  try {
    const rawItem = structuredClone(entry.item) as JsonObject;
    return [
      {
        itemId,
        resultId: readString(entry.id),
        rawItem,
        listingSnapshot: createListingSnapshot(entry),
        fetchUrl: context.fetchUrl,
        capturedAt: context.capturedAt,
      },
    ];
  } catch {
    return [];
  }
}

function createListingSnapshot(result: Record<string, unknown>): ListingSnapshot {
  const listing = isRecord(result.listing) ? result.listing : null;
  const account = listing && isRecord(listing.account) ? listing.account : null;

  return {
    resultId: readString(result.id),
    price: createPriceSnapshot(listing?.price),
    sellerAccount: readString(account?.name),
    indexedAt: readString(listing?.indexed),
  };
}

function createPriceSnapshot(value: unknown): PriceSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }

  const amount = value.amount;
  const currency = readNonEmptyString(value.currency);
  if (typeof amount !== "number" || !Number.isFinite(amount) || !currency) {
    return null;
  }

  return {
    amount,
    currency,
    type: readString(value.type),
  };
}

function readNonEmptyString(value: unknown): string | null {
  const stringValue = readString(value);
  return stringValue && stringValue.trim() ? stringValue : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
