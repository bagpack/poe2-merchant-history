import type { PurchaseRecord } from "./types.js";

const CSV_HEADERS = [
  "status",
  "candidate_at",
  "purchased_at",
  "item_name",
  "base_type",
  "item_level",
  "price_amount",
  "price_currency",
  "seller",
  "league",
  "item_id",
  "result_id",
  "page_url",
];

export function buildPurchaseCsv(records: PurchaseRecord[]): string {
  const rows = records.map((record) => [
    record.status,
    toIsoDate(record.candidateAt),
    toIsoDate(record.purchasedAt),
    record.summary.displayName,
    record.summary.baseType,
    record.summary.itemLevel,
    record.listingSnapshot.price?.amount,
    record.listingSnapshot.price?.currency,
    record.listingSnapshot.sellerAccount,
    record.league,
    record.itemId,
    record.listingSnapshot.resultId,
    record.source.pageUrl,
  ]);
  return [CSV_HEADERS, ...rows].map((row) => row.map(toCsvCell).join(",")).join("\n") + "\n";
}

export function buildPurchaseJson(records: PurchaseRecord[]): string {
  return JSON.stringify(records, null, 2) + "\n";
}

function toIsoDate(value: number | null): string {
  return value === null ? "" : new Date(value).toISOString();
}

function toCsvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
