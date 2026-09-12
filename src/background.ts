import { openLeagueDb, requestToPromise, transactionComplete } from "./shared.js";
import { getAcceptLanguage, getHostForLanguage } from "./i18n.js";
import {
  handlePurchaseHistoryMessage,
  isPurchaseCandidateMessage,
  savePurchaseCandidate,
} from "./purchase/background-handler.js";
import { parsePurchaseHistoryMessage } from "./purchase/messages.js";

const REQUIRED_COOKIES = ["POESESSID"] as const;

type ErrorCode =
  | "LEAGUE_MISMATCH"
  | "DUPLICATE_ID"
  | "FETCH_FAILED"
  | "AUTH_EXPIRED"
  | "RATE_LIMIT"
  | "UNKNOWN";

interface HistoryItem {
  league: string;
  name?: string;
  typeLine: string;
}

interface HistoryPrice {
  currency: string;
  amount: number;
}

interface HistoryEntry {
  item_id?: string;
  item?: HistoryItem;
  price?: HistoryPrice;
  time?: string;
}

interface HistoryApiResponse {
  result?: HistoryEntry[];
}

interface TradeHistoryRecord {
  id: string;
  item_name: string;
  item_name_unique: string | null;
  currency: string;
  amount: number;
  time: string;
  league: string;
  details_json: HistoryItem;
  source_item_key: string;
}

interface AppErrorMeta {
  expectedLeague?: string;
  actualLeague?: string;
  status?: number;
  missing?: readonly string[];
  remainingSec?: number;
}

type UpdateRequestSource = "user" | "automatic";

class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly meta: AppErrorMeta | null
  ) {
    super(message);
  }
}

class HistoryNormalizer {
  normalize(apiResponse: HistoryApiResponse, leagueId: string): TradeHistoryRecord[] {
    if (!apiResponse || !Array.isArray(apiResponse.result)) {
      throw new AppError("FETCH_FAILED", "Result is missing.", null);
    }

    const records: TradeHistoryRecord[] = [];
    const seenIds = new Set<string>();

    for (const entry of apiResponse.result) {
      const itemId = entry?.item_id;
      const item = entry?.item;
      const price = entry?.price;
      const time = entry?.time;

      if (!itemId || !item || !price || !time) {
        continue;
      }

      if (item.league !== leagueId) {
        throw new AppError("LEAGUE_MISMATCH", "League mismatch.", {
          expectedLeague: leagueId,
          actualLeague: item.league,
        });
      }

      if (seenIds.has(itemId)) {
        continue;
      }
      seenIds.add(itemId);

      records.push({
        id: itemId,
        item_name: item.name && item.name.trim() ? `${item.name} ${item.typeLine}` : item.typeLine,
        item_name_unique: item.name && item.name.trim() ? item.name : null,
        currency: price.currency,
        amount: price.amount,
        time,
        league: item.league,
        details_json: item,
        source_item_key: leagueId,
      });
    }

    return records;
  }
}

class AuthCookieService {
  async ensureAuthCookies(language: string): Promise<void> {
    const results = await Promise.all(
      REQUIRED_COOKIES.map((name) => this.getCookie(name, language))
    );
    const missing = REQUIRED_COOKIES.filter((_name, index) => !results[index]);
    if (missing.length > 0) {
      throw new AppError("AUTH_EXPIRED", "Login expired.", { missing });
    }
  }

  private async getCookie(name: string, language: string): Promise<chrome.cookies.Cookie | null> {
    const host = getHostForLanguage(language);
    return new Promise((resolve) => {
      chrome.cookies.get(
        {
          url: `https://${host}`,
          name,
        },
        (cookie) => resolve(cookie || null)
      );
    });
  }
}

class HistoryApiClient {
  async fetchHistory(leagueId: string, language: string): Promise<HistoryApiResponse> {
    const host = getHostForLanguage(language);
    const baseUrl = `https://${host}`;
    const url = `${baseUrl}/api/trade2/history/${encodeURIComponent(leagueId)}`;
    const response = await fetch(url, {
      credentials: "include",
      headers: {
        accept: "*/*",
        "accept-language": getAcceptLanguage(language),
        "x-requested-with": "XMLHttpRequest",
      },
      referrer: `${baseUrl}/trade2/history`,
      referrerPolicy: "no-referrer-when-downgrade",
    });

    if (!response.ok) {
      throw new AppError("FETCH_FAILED", "Failed to fetch history.", {
        status: response.status,
      });
    }

    return response.json() as Promise<HistoryApiResponse>;
  }
}

class TradeHistoryRepository {
  async saveRecords(
    leagueId: string,
    language: string,
    records: TradeHistoryRecord[]
  ): Promise<number> {
    if (records.length === 0) {
      return 0;
    }

    const db = await openLeagueDb(leagueId, language);
    const tx = db.transaction("trade_history", "readwrite");
    const store = tx.objectStore("trade_history");

    let addedCount = 0;
    try {
      for (const record of records) {
        const exists = await requestToPromise(store.get(record.id));
        if (exists) {
          continue;
        }
        const added = await this.addRecord(store, record);
        if (added) {
          addedCount += 1;
        }
      }
    } catch (error) {
      tx.abort();
      throw error;
    }

    await transactionComplete(tx);
    db.close();
    return addedCount;
  }

  async countRecords(leagueId: string, language: string): Promise<number> {
    const db = await openLeagueDb(leagueId, language);
    const tx = db.transaction("trade_history", "readonly");
    const store = tx.objectStore("trade_history");
    const count = await requestToPromise(store.count());
    await transactionComplete(tx);
    db.close();
    return Number(count);
  }

  private async addRecord(store: IDBObjectStore, record: TradeHistoryRecord): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const request = store.add(record);
      request.onsuccess = () => resolve(true);
      request.onerror = () => {
        const error = request.error;
        if (error && error.name === "ConstraintError") {
          resolve(false);
          return;
        }
        reject(error || new Error("IDB_ADD_FAILED"));
      };
    });
  }
}

class RateLimiter {
  private readonly minIntervalMs = 60 * 1000;

  async enforce(): Promise<void> {
    const now = Date.now();
    const lastRun = await new Promise<number>((resolve) => {
      chrome.storage.local.get(["lastHistoryFetchAt"], (data: Record<string, unknown>) =>
        resolve(Number(data.lastHistoryFetchAt || 0))
      );
    });

    const elapsed = now - lastRun;
    if (elapsed < this.minIntervalMs) {
      const remainingMs = this.minIntervalMs - elapsed;
      const remainingSec = Math.ceil(remainingMs / 1000);
      throw new AppError("RATE_LIMIT", `Update limited. Wait ${remainingSec} seconds.`, {
        remainingSec,
      });
    }

    await this.recordRun(now);
  }

  async recordRun(now = Date.now()): Promise<void> {
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ lastHistoryFetchAt: now }, () => resolve());
    });
  }
}

class HistoryUpdateService {
  constructor(
    private readonly rateLimiter: RateLimiter,
    private readonly authCookieService: AuthCookieService,
    private readonly apiClient: HistoryApiClient,
    private readonly normalizer: HistoryNormalizer,
    private readonly repository: TradeHistoryRepository
  ) {}

  async updateHistory(
    leagueId: string,
    language: string,
    requestSource: UpdateRequestSource
  ): Promise<{
    addedCount: number;
    fetchedCount: number;
    totalCount: number;
  }> {
    if (requestSource === "automatic") {
      await this.rateLimiter.enforce();
    }
    await this.authCookieService.ensureAuthCookies(language);
    const apiResponse = await this.apiClient.fetchHistory(leagueId, language);
    if (requestSource === "user") {
      await this.rateLimiter.recordRun();
    }
    const records = this.normalizer.normalize(apiResponse, leagueId);
    const addedCount = await this.repository.saveRecords(leagueId, language, records);
    const totalCount = await this.repository.countRecords(leagueId, language);
    return { addedCount, fetchedCount: records.length, totalCount };
  }
}

const updateService = new HistoryUpdateService(
  new RateLimiter(),
  new AuthCookieService(),
  new HistoryApiClient(),
  new HistoryNormalizer(),
  new TradeHistoryRepository()
);

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (isPurchaseCandidateMessage(message)) {
    savePurchaseCandidate(message)
      .then((record) => {
        notifyPurchaseHistoryChanged();
        sendResponse({ ok: true, data: record });
      })
      .catch((error: unknown) =>
        sendResponse({
          ok: false,
          error: {
            code: "PURCHASE_SAVE_FAILED",
            message: error instanceof Error ? error.message : "Unexpected error.",
          },
        })
      );
    return true;
  }

  const purchaseHistoryMessage = parsePurchaseHistoryMessage(message);
  if (purchaseHistoryMessage) {
    handlePurchaseHistoryMessage(purchaseHistoryMessage)
      .then((data) => {
        if (purchaseHistoryMessage.type !== "purchase/list") {
          notifyPurchaseHistoryChanged(readUndoToken(data));
        }
        sendResponse({ ok: true, data });
      })
      .catch((error: unknown) =>
        sendResponse({
          ok: false,
          error: {
            code: "PURCHASE_HISTORY_FAILED",
            message: error instanceof Error ? error.message : "Unexpected error.",
          },
        })
      );
    return true;
  }

  if (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    (message as { type?: string }).type === "updateHistory"
  ) {
    const typedMessage = message as {
      type: string;
      leagueId?: string;
      language?: string;
      requestSource?: UpdateRequestSource;
    };
    updateService
      .updateHistory(
        typedMessage.leagueId || "",
        typedMessage.language || "en",
        typedMessage.requestSource === "user" ? "user" : "automatic"
      )
      .then((result) => {
        sendResponse({ ok: true, result });
      })
      .catch((error: unknown) => {
        const appError = error instanceof AppError ? error : null;
        sendResponse({
          ok: false,
          error: {
            code: appError?.code || "UNKNOWN",
            message:
              appError?.message || (error instanceof Error ? error.message : "Unexpected error."),
            meta: appError?.meta || null,
          },
        });
      });
    return true;
  }

  sendResponse({ ok: false, error: { code: "UNKNOWN", message: "Unknown request." } });
  return false;
});

function notifyPurchaseHistoryChanged(undoToken?: string): void {
  void chrome.runtime
    .sendMessage({ type: "purchase/changed", ...(undoToken ? { undoToken } : {}) })
    .catch(() => undefined);
}

function readUndoToken(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || !Object.hasOwn(value, "undo")) {
    return undefined;
  }
  const undo = (value as { undo?: unknown }).undo;
  if (typeof undo !== "object" || undo === null || !Object.hasOwn(undo, "token")) {
    return undefined;
  }
  const token = (undo as { token?: unknown }).token;
  return typeof token === "string" && token.length > 0 ? token : undefined;
}

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
});
