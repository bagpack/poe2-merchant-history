import type { PurchaseStatus } from "./types.js";

export const PURCHASE_HISTORY_FILTERS_STORAGE_KEY = "purchaseHistoryFilters";

export interface PurchaseHistoryFilterPreferences {
  status: "" | PurchaseStatus;
  itemName: string;
  league: string;
  dateFrom: string;
  dateTo: string;
}

const DEFAULT_FILTERS: PurchaseHistoryFilterPreferences = {
  status: "",
  itemName: "",
  league: "",
  dateFrom: "",
  dateTo: "",
};

export function parsePurchaseHistoryFilterPreferences(
  value: unknown
): PurchaseHistoryFilterPreferences {
  if (!isRecord(value)) {
    return { ...DEFAULT_FILTERS };
  }

  return {
    status: value.status === "pending" || value.status === "purchased" ? value.status : "",
    itemName: readText(value.itemName),
    league: readText(value.league),
    dateFrom: readDate(value.dateFrom),
    dateTo: readDate(value.dateTo),
  };
}

export function loadPurchaseHistoryFilterPreferences(): Promise<PurchaseHistoryFilterPreferences> {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      [PURCHASE_HISTORY_FILTERS_STORAGE_KEY],
      (data: Record<string, unknown>) =>
        resolve(parsePurchaseHistoryFilterPreferences(data[PURCHASE_HISTORY_FILTERS_STORAGE_KEY]))
    );
  });
}

export function savePurchaseHistoryFilterPreferences(
  preferences: PurchaseHistoryFilterPreferences
): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [PURCHASE_HISTORY_FILTERS_STORAGE_KEY]: preferences }, () =>
      resolve()
    );
  });
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.slice(0, 200) : "";
}

function readDate(value: unknown): string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
