export function toLeagueKey(leagueId) {
  return leagueId
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_]/g, "");
}

export function openLeagueDb(leagueId) {
  const dbName = `poe2-trade-history-${toLeagueKey(leagueId)}`;

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
