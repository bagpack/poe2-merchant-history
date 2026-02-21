import { getLocaleForLanguage, t } from "../i18n.js";
import { toLeagueKey } from "../shared.js";
import type { Language, TradeRecord } from "./types.js";

const currencyOrder = [
  "divine",
  "exalted",
  "chaos",
  "annul",
  "regal",
  "alchemy",
  "chance",
  "scour",
  "transmute",
  "alteration",
  "augmentation",
  "wisdom",
];

export function formatDateTime(isoString: string, language: Language): string {
  const date = new Date(isoString);
  return date.toLocaleString(getLocaleForLanguage(language));
}

export function formatDateKey(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatItemName(record: TradeRecord): string {
  const name = record.details_json?.name?.trim() || "";
  const typeLine = record.details_json?.typeLine?.trim() || record.item_name || "";
  if (name && typeLine) {
    return `${name} ${typeLine}`;
  }
  return typeLine || name || "";
}

function csvEscape(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

export function buildCsv(records: TradeRecord[], language: Language): string {
  const header = [
    t(language, "csvHeaderDate"),
    t(language, "csvHeaderItem"),
    t(language, "csvHeaderCurrency"),
    t(language, "csvHeaderAmount"),
  ];
  const rows = records.map((record) => [
    formatDateTime(record.time, language),
    formatItemName(record),
    record.currency ?? "",
    String(record.amount ?? ""),
  ]);
  const lines = [header, ...rows].map((row) => row.map((value) => csvEscape(value)).join(","));
  return "\ufeff" + lines.join("\n");
}

export function buildCsvFilename(leagueId: string): string {
  const key = toLeagueKey(leagueId);
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const dd = `${date.getDate()}`.padStart(2, "0");
  return `merchant-history_${key}_${yyyy}-${mm}-${dd}.csv`;
}

export function downloadCsv(csvText: string, filename: string): void {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function buildCurrencyOrder(records: TradeRecord[]): string[] {
  const seen = new Set(currencyOrder);
  const extra: string[] = [];
  records.forEach((record) => {
    const currency = record.currency;
    if (currency && !seen.has(currency)) {
      seen.add(currency);
      extra.push(currency);
    }
  });
  return [...currencyOrder, ...extra];
}
