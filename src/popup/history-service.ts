import { getHostForLanguage, t } from "../i18n.js";
import { openLeagueDb, requestToPromise } from "../shared.js";
import type {
  HistoryResponsePayload,
  Language,
  LeagueOption,
  TradeRecord,
  UpdateRequestSource,
} from "./types.js";

interface LeagueApiResponse {
  result?: Array<LeagueOption & { realm?: string }>;
}

async function loadLeaguesFromApi(host: string): Promise<LeagueOption[]> {
  const response = await fetch(`https://${host}/api/trade2/data/leagues`, {
    credentials: "include",
  });
  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as LeagueApiResponse;
  return (payload.result || [])
    .filter((league) => league.realm === undefined || league.realm === "poe2")
    .map((league) => ({ id: league.id, text: league.text }));
}

export class HistoryService {
  constructor(private readonly languageProvider: () => Language) {}

  async loadLeagues(): Promise<LeagueOption[]> {
    const host = getHostForLanguage(this.languageProvider());
    const leagues = await loadLeaguesFromApi(host);
    if (leagues.length === 0) {
      throw new Error(t(this.languageProvider(), "modalLeagueFetchFailed"));
    }

    return leagues;
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

  async requestUpdate(
    leagueId: string,
    requestSource: UpdateRequestSource
  ): Promise<HistoryResponsePayload> {
    return chrome.runtime.sendMessage({
      type: "updateHistory",
      leagueId,
      language: this.languageProvider(),
      requestSource,
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
