import { normalizeLanguage } from "./i18n.js";

type UnknownRecord = Record<string, unknown>;

interface TradeHistoryRecord extends UnknownRecord {
  id: string;
}

interface MigratorStateStore {
  getFlag(flagKey: string): Promise<boolean>;
  setFlag(flagKey: string): void;
}

class ChromeMigratorStateStore implements MigratorStateStore {
  async getFlag(flagKey: string): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.storage.local.get([flagKey], (data: Record<string, unknown>) => {
        resolve(Boolean(data[flagKey]));
      });
    });
  }

  setFlag(flagKey: string): void {
    chrome.storage.local.set({ [flagKey]: true });
  }
}

class TradeHistoryDbRepository {
  getLeagueDbName(leagueId: string, language: string): string {
    const langKey = normalizeLanguage(language);
    return `poe2-trade-history-${langKey}-${toLeagueKey(leagueId)}`;
  }

  getLegacyDbName(leagueId: string): string {
    return `poe2-trade-history-${toLeagueKey(leagueId)}`;
  }

  openLeagueDb(leagueId: string, language: string): Promise<IDBDatabase> {
    const dbName = this.getLeagueDbName(leagueId, language);
    return this.openDbWithSchema(dbName);
  }

  async databaseExists(name: string): Promise<boolean> {
    if (!indexedDB.databases) {
      return false;
    }
    const databases = await indexedDB.databases();
    return databases.some((db) => db.name === name);
  }

  openDbByName(dbName: string): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllRecords(db: IDBDatabase): Promise<TradeHistoryRecord[]> {
    const tx = db.transaction("trade_history", "readonly");
    const store = tx.objectStore("trade_history");
    const records = (await requestToPromise(store.getAll())) as TradeHistoryRecord[];
    await transactionComplete(tx);
    return records;
  }

  async countRecords(db: IDBDatabase): Promise<number> {
    const tx = db.transaction("trade_history", "readonly");
    const store = tx.objectStore("trade_history");
    const count = (await requestToPromise(store.count())) as number;
    await transactionComplete(tx);
    return count;
  }

  async addAll(db: IDBDatabase, records: TradeHistoryRecord[]): Promise<void> {
    const tx = db.transaction("trade_history", "readwrite");
    const store = tx.objectStore("trade_history");
    for (const record of records) {
      store.add(record);
    }
    await transactionComplete(tx);
  }

  private openDbWithSchema(dbName: string): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        let store: IDBObjectStore;
        if (!db.objectStoreNames.contains("trade_history")) {
          store = db.createObjectStore("trade_history", { keyPath: "id" });
        } else {
          const transaction = request.transaction;
          if (!transaction) {
            throw new Error("missing transaction during schema upgrade");
          }
          store = transaction.objectStore("trade_history");
        }

        if (!store.indexNames.contains("time")) {
          store.createIndex("time", "time", { unique: false });
        }
        if (!store.indexNames.contains("currency")) {
          store.createIndex("currency", "currency", { unique: false });
        }
        if (!store.indexNames.contains("amount")) {
          store.createIndex("amount", "amount", { unique: false });
        }
        if (!store.indexNames.contains("item_name")) {
          store.createIndex("item_name", "item_name", { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

class LegacyDbMigrator {
  constructor(
    private readonly repository: TradeHistoryDbRepository,
    private readonly stateStore: MigratorStateStore
  ) {}

  async migrateIfNeeded(leagueId: string): Promise<void> {
    const leagueKey = toLeagueKey(leagueId);
    const flagKey = `legacyDbMigrated_${leagueKey}`;

    try {
      const alreadyMigrated = await this.stateStore.getFlag(flagKey);
      if (alreadyMigrated) {
        return;
      }

      const legacyName = this.repository.getLegacyDbName(leagueId);
      const hasLegacy = await this.repository.databaseExists(legacyName);
      if (!hasLegacy) {
        this.stateStore.setFlag(flagKey);
        return;
      }

      const targetDb = await this.repository.openLeagueDb(leagueId, "ja");
      const targetCount = await this.repository.countRecords(targetDb);
      if (targetCount > 0) {
        this.stateStore.setFlag(flagKey);
        targetDb.close();
        return;
      }

      const legacyDb = await this.repository.openDbByName(legacyName);
      const legacyRecords = await this.repository.getAllRecords(legacyDb);
      legacyDb.close();

      if (legacyRecords.length === 0) {
        this.stateStore.setFlag(flagKey);
        targetDb.close();
        return;
      }

      // Why: We import records as-is so historical item payloads stay byte-compatible
      // with existing analytics logic that reads raw `details_json` values.
      await this.repository.addAll(targetDb, legacyRecords);
      targetDb.close();
      this.stateStore.setFlag(flagKey);
    } catch (_error) {
      // Why: We fail-open and mark migration done to avoid blocking popup load when
      // old DB metadata is partially corrupted in browser storage.
      this.stateStore.setFlag(flagKey);
    }
  }
}

const repository = new TradeHistoryDbRepository();
const migrator = new LegacyDbMigrator(repository, new ChromeMigratorStateStore());

export function toLeagueKey(leagueId: string): string {
  return leagueId
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_]/g, "");
}

export function openLeagueDb(leagueId: string, language: string): Promise<IDBDatabase> {
  return repository.openLeagueDb(leagueId, language);
}

export async function migrateLegacyDbIfNeeded(leagueId: string): Promise<void> {
  await migrator.migrateIfNeeded(leagueId);
}

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function transactionComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
    tx.onerror = () => reject(tx.error || new Error("Transaction failed"));
  });
}
