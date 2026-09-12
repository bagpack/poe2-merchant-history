import { getPurchaseRecordId, mergePurchaseCandidate } from "./candidate.js";
import { markPurchaseAsPurchased } from "./status.js";
import { PURCHASE_UNDO_WINDOW_MS } from "./undo.js";
import type {
  PurchaseCandidateInput,
  PurchaseMutationResult,
  PurchaseRecord,
  PurchaseUndoAction,
  PurchaseUndoResult,
  PurchaseUndoType,
} from "./types.js";

const DATABASE_NAME = "poe2-purchase-history";
const DATABASE_VERSION = 2;
const PURCHASES_STORE = "purchases";
const UNDO_STORE = "purchase_undo";
const UNDO_KEY = "latest";

export class PurchaseRepository {
  async upsertCandidate(candidate: PurchaseCandidateInput): Promise<PurchaseRecord> {
    const db = await openPurchaseDb();
    try {
      const tx = db.transaction([PURCHASES_STORE, UNDO_STORE], "readwrite");
      const store = tx.objectStore(PURCHASES_STORE);
      const id = getPurchaseRecordId(candidate);
      const existing = (await requestToPromise(store.get(id))) as PurchaseRecord | undefined;
      const record = mergePurchaseCandidate(existing ?? null, candidate);
      store.put(record);
      tx.objectStore(UNDO_STORE).clear();
      await transactionComplete(tx);
      return record;
    } finally {
      db.close();
    }
  }

  async countPending(): Promise<number> {
    const db = await openPurchaseDb();
    try {
      const tx = db.transaction(PURCHASES_STORE, "readonly");
      const count = await requestToPromise(
        tx.objectStore(PURCHASES_STORE).index("status").count("pending")
      );
      await transactionComplete(tx);
      return Number(count);
    } finally {
      db.close();
    }
  }

  async list(): Promise<PurchaseRecord[]> {
    const db = await openPurchaseDb();
    try {
      const tx = db.transaction(PURCHASES_STORE, "readonly");
      const records = (await requestToPromise(
        tx.objectStore(PURCHASES_STORE).getAll()
      )) as PurchaseRecord[];
      await transactionComplete(tx);
      return records.sort((left, right) => right.updatedAt - left.updatedAt);
    } finally {
      db.close();
    }
  }

  async markPurchased(id: string): Promise<PurchaseMutationResult | null> {
    const db = await openPurchaseDb();
    try {
      const tx = db.transaction([PURCHASES_STORE, UNDO_STORE], "readwrite");
      const store = tx.objectStore(PURCHASES_STORE);
      const existing = (await requestToPromise(store.get(id))) as PurchaseRecord | undefined;
      const updated = existing ? markPurchaseAsPurchased(existing) : null;
      if (!updated || !existing) {
        await transactionComplete(tx);
        return null;
      }
      const undo = createUndoAction("mark-purchased", existing, updated.updatedAt);
      store.put(updated);
      tx.objectStore(UNDO_STORE).put(undo);
      await transactionComplete(tx);
      return { record: updated, undo };
    } finally {
      db.close();
    }
  }

  async delete(id: string): Promise<PurchaseMutationResult | null> {
    const db = await openPurchaseDb();
    try {
      const tx = db.transaction([PURCHASES_STORE, UNDO_STORE], "readwrite");
      const store = tx.objectStore(PURCHASES_STORE);
      const existing = (await requestToPromise(store.get(id))) as PurchaseRecord | undefined;
      if (!existing) {
        await transactionComplete(tx);
        return null;
      }
      const appliedAt = Date.now();
      const undo = createUndoAction("delete", existing, appliedAt);
      store.delete(id);
      tx.objectStore(UNDO_STORE).put(undo);
      await transactionComplete(tx);
      return { record: existing, undo };
    } finally {
      db.close();
    }
  }

  async deleteAll(): Promise<void> {
    const db = await openPurchaseDb();
    try {
      const tx = db.transaction([PURCHASES_STORE, UNDO_STORE], "readwrite");
      tx.objectStore(PURCHASES_STORE).clear();
      tx.objectStore(UNDO_STORE).clear();
      await transactionComplete(tx);
    } finally {
      db.close();
    }
  }

  async undo(token: string): Promise<PurchaseUndoResult | null> {
    const db = await openPurchaseDb();
    try {
      const tx = db.transaction([PURCHASES_STORE, UNDO_STORE], "readwrite");
      const undoStore = tx.objectStore(UNDO_STORE);
      const action = (await requestToPromise(undoStore.get(UNDO_KEY))) as
        | PurchaseUndoAction
        | undefined;
      if (!action || action.token !== token || action.expiresAt <= Date.now()) {
        undoStore.delete(UNDO_KEY);
        await transactionComplete(tx);
        return null;
      }

      const purchaseStore = tx.objectStore(PURCHASES_STORE);
      const current = (await requestToPromise(purchaseStore.get(action.recordId))) as
        | PurchaseRecord
        | undefined;
      if (!canRestore(action, current)) {
        undoStore.delete(UNDO_KEY);
        await transactionComplete(tx);
        return null;
      }

      purchaseStore.put(action.previousRecord);
      undoStore.delete(UNDO_KEY);
      await transactionComplete(tx);
      return { type: action.type, record: action.previousRecord };
    } finally {
      db.close();
    }
  }

  async latestUndo(): Promise<PurchaseUndoAction | null> {
    const db = await openPurchaseDb();
    try {
      const tx = db.transaction(UNDO_STORE, "readwrite");
      const store = tx.objectStore(UNDO_STORE);
      const action = (await requestToPromise(store.get(UNDO_KEY))) as
        | PurchaseUndoAction
        | undefined;
      if (!action || action.expiresAt <= Date.now()) {
        store.delete(UNDO_KEY);
        await transactionComplete(tx);
        return null;
      }
      await transactionComplete(tx);
      return action;
    } finally {
      db.close();
    }
  }
}

function openPurchaseDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (event.oldVersion < 1) {
        const store = db.createObjectStore(PURCHASES_STORE, { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
      }
      if (event.oldVersion < 2) {
        db.createObjectStore(UNDO_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function createUndoAction(
  type: PurchaseUndoType,
  previousRecord: PurchaseRecord,
  appliedAt: number
): PurchaseUndoAction {
  return {
    id: UNDO_KEY,
    token: crypto.randomUUID(),
    type,
    recordId: previousRecord.id,
    previousRecord,
    appliedAt,
    expiresAt: appliedAt + PURCHASE_UNDO_WINDOW_MS,
  };
}

function canRestore(action: PurchaseUndoAction, current: PurchaseRecord | undefined): boolean {
  if (action.type === "delete") {
    return !current;
  }
  return current?.status === "purchased" && current.updatedAt === action.appliedAt;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
