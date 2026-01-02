import { normalizeLanguage } from "./i18n.js";

export function toLeagueKey(leagueId) {
  return leagueId
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_]/g, "");
}

function getLeagueDbName(leagueId, language) {
  const langKey = normalizeLanguage(language);
  return `poe2-trade-history-${langKey}-${toLeagueKey(leagueId)}`;
}

function getLegacyDbName(leagueId) {
  return `poe2-trade-history-${toLeagueKey(leagueId)}`;
}

export function openLeagueDb(leagueId, language) {
  const dbName = getLeagueDbName(leagueId, language);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      let store;
      if (!db.objectStoreNames.contains("trade_history")) {
        store = db.createObjectStore("trade_history", { keyPath: "id" });
      } else {
        store = request.transaction.objectStore("trade_history");
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

async function databaseExists(name) {
  if (!indexedDB.databases) {
    return false;
  }
  const databases = await indexedDB.databases();
  return databases.some((db) => db.name === name);
}

function openDbByName(dbName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllRecords(db) {
  const tx = db.transaction("trade_history", "readonly");
  const store = tx.objectStore("trade_history");
  const records = await requestToPromise(store.getAll());
  await transactionComplete(tx);
  return records;
}

async function countRecords(db) {
  const tx = db.transaction("trade_history", "readonly");
  const store = tx.objectStore("trade_history");
  const count = await requestToPromise(store.count());
  await transactionComplete(tx);
  return count;
}

export async function migrateLegacyDbIfNeeded(leagueId) {
  const leagueKey = toLeagueKey(leagueId);
  const flagKey = `legacyDbMigrated_${leagueKey}`;
  try {
    const stored = await new Promise((resolve) => {
      chrome.storage.local.get([flagKey], (data) => resolve(data[flagKey]));
    });
    if (stored) {
      return;
    }

    const legacyName = getLegacyDbName(leagueId);
    const hasLegacy = await databaseExists(legacyName);
    if (!hasLegacy) {
      chrome.storage.local.set({ [flagKey]: true });
      return;
    }

    const targetDb = await openLeagueDb(leagueId, "ja");
    const targetCount = await countRecords(targetDb);
    if (targetCount > 0) {
      chrome.storage.local.set({ [flagKey]: true });
      targetDb.close();
      return;
    }

    const legacyDb = await openDbByName(legacyName);
    const legacyRecords = await getAllRecords(legacyDb);
    legacyDb.close();

    if (legacyRecords.length === 0) {
      chrome.storage.local.set({ [flagKey]: true });
      targetDb.close();
      return;
    }

    const tx = targetDb.transaction("trade_history", "readwrite");
    const store = tx.objectStore("trade_history");
    for (const record of legacyRecords) {
      store.add(record);
    }
    await transactionComplete(tx);
    targetDb.close();
    chrome.storage.local.set({ [flagKey]: true });
  } catch (error) {
    chrome.storage.local.set({ [flagKey]: true });
  }
}

export function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function transactionComplete(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
    tx.onerror = () => reject(tx.error || new Error("Transaction failed"));
  });
}
