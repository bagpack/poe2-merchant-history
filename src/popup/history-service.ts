import { getHostForLanguage, t } from "../i18n.js";
import { openLeagueDb, requestToPromise } from "../shared.js";
import type { HistoryResponsePayload, Language, LeagueOption, TradeRecord } from "./types.js";

interface TradePageConfig {
  leagues?: LeagueOption[];
}

function extractObjectLiteral(source: string, marker: string): string {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error("Failed to parse trade config");
  }
  let index = source.indexOf("{", markerIndex);
  if (index === -1) {
    throw new Error("Failed to parse trade config");
  }

  let depth = 0;
  let endIndex = -1;
  for (; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        endIndex = index + 1;
        break;
      }
    }
  }

  if (endIndex === -1) {
    throw new Error("Failed to parse trade config");
  }

  return source.slice(source.indexOf("{", markerIndex), endIndex);
}

function extractTradeConfig(html: string): TradePageConfig {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const scripts = Array.from(doc.querySelectorAll("script"));
  const target = scripts
    .map((script) => script.textContent || "")
    .find((text) => text.includes('require(["trade"]') && text.includes("leagues"));

  if (!target) {
    throw new Error("Failed to load trade config");
  }

  const configText = extractObjectLiteral(target, "t(");
  return JSON.parse(configText) as TradePageConfig;
}

export class HistoryService {
  constructor(private readonly languageProvider: () => Language) {}

  async loadLeagues(): Promise<LeagueOption[]> {
    const host = getHostForLanguage(this.languageProvider());
    const response = await fetch(`https://${host}/trade2/history`, {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error(t(this.languageProvider(), "modalLeagueFetchFailed"));
    }
    const html = await response.text();
    const config = extractTradeConfig(html);
    return config.leagues || [];
  }

  async loadRecords(leagueId: string): Promise<TradeRecord[]> {
    const db = await openLeagueDb(leagueId, this.languageProvider());
    const tx = db.transaction("trade_history", "readonly");
    const store = tx.objectStore("trade_history");
    const records = (await requestToPromise(store.getAll())) as TradeRecord[];
    db.close();

    return records
      .map((record) => ({
        ...record,
        _timeMs: Date.parse(record.time),
      }))
      .sort((a, b) => (b._timeMs || 0) - (a._timeMs || 0));
  }

  async requestUpdate(leagueId: string): Promise<HistoryResponsePayload> {
    return chrome.runtime.sendMessage({
      type: "updateHistory",
      leagueId,
      language: this.languageProvider(),
    }) as Promise<HistoryResponsePayload>;
  }

  storeSelectedLeague(leagueId: string): void {
    chrome.storage.local.set({ leagueId });
  }

  storePageSize(pageSize: string): void {
    chrome.storage.local.set({ pageSize });
  }

  loadPageSize(): Promise<string | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get(["pageSize"], (data: Record<string, unknown>) =>
        resolve((data.pageSize as string | undefined) || null)
      );
    });
  }

  loadSelectedLeague(): Promise<string | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get(["leagueId"], (data: Record<string, unknown>) =>
        resolve((data.leagueId as string | undefined) || null)
      );
    });
  }
}
