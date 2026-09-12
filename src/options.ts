import {
  applyTranslations,
  getHostForLanguage,
  getLocaleForLanguage,
  loadUiLanguage,
  normalizeLanguage,
  t,
} from "./i18n.js";

type CookieViewModel = {
  name: string;
  value: string | null;
  expirationDate: number | null;
};

type BackupStoreDef = {
  keyPath: string | string[] | null;
  autoIncrement: boolean;
  indexes: Array<{
    name: string;
    keyPath: string | string[];
    unique: boolean;
    multiEntry: boolean;
  }>;
  entries: Array<{ key: IDBValidKey; value: unknown }>;
};

type BackupDbDef = {
  name: string;
  version: number;
  stores: Record<string, BackupStoreDef>;
};

type BackupPayload = {
  exportedAt: string;
  extensionId: string;
  storageLocal: Record<string, unknown>;
  dbs: BackupDbDef[];
};

class CookieService {
  constructor(private readonly getLanguage: () => string) {}

  async getCookie(name: string): Promise<chrome.cookies.Cookie | null> {
    const host = getHostForLanguage(this.getLanguage());
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

class BackupService {
  private readonly dbPrefix = "poe2-trade-history-";

  async exportBackup(): Promise<BackupPayload> {
    const storageLocal = await chrome.storage.local.get(null);
    const dbNames = await this.listBackupDatabases();
    const dbs: BackupDbDef[] = [];

    for (const dbName of dbNames) {
      dbs.push(await this.dumpDatabase(dbName));
    }

    return {
      exportedAt: new Date().toISOString(),
      extensionId: chrome.runtime.id,
      storageLocal,
      dbs,
    };
  }

  async importBackup(payload: BackupPayload): Promise<void> {
    await chrome.storage.local.set(payload.storageLocal || {});

    for (const dbDef of payload.dbs || []) {
      await this.deleteDatabaseIfExists(dbDef.name);
      const db = await this.openDatabaseWithSchema(dbDef);
      const storeNames = Object.keys(dbDef.stores);
      const tx = db.transaction(storeNames, "readwrite");

      for (const storeName of storeNames) {
        const store = tx.objectStore(storeName);
        const entries = dbDef.stores[storeName].entries || [];
        for (const entry of entries) {
          if (store.keyPath == null) {
            store.put(entry.value, entry.key);
          } else {
            store.put(entry.value);
          }
        }
      }

      await this.waitTransaction(tx);
      db.close();
    }
  }

  downloadBackup(payload: BackupPayload): void {
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `poe2mh-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async pickBackupFile(): Promise<BackupPayload> {
    const text = await new Promise<string>((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json";
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          reject(new Error("no file selected"));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error || new Error("failed to read file"));
        reader.readAsText(file);
      };
      input.click();
    });

    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("invalid backup format");
    }
    return parsed as BackupPayload;
  }

  private async listBackupDatabases(): Promise<string[]> {
    if (!indexedDB.databases) {
      return [];
    }
    const databases = await indexedDB.databases();
    return databases
      .map((db) => db.name)
      .filter(
        (name): name is string =>
          typeof name === "string" &&
          (name.startsWith(this.dbPrefix) || name === "poe2-purchase-history")
      );
  }

  private async dumpDatabase(dbName: string): Promise<BackupDbDef> {
    const db = await this.openDatabase(dbName);
    const storeNames = Array.from(db.objectStoreNames);
    const tx = db.transaction(storeNames, "readonly");

    const stores: Record<string, BackupStoreDef> = {};
    for (const storeName of storeNames) {
      const store = tx.objectStore(storeName);
      const indexes = Array.from(store.indexNames).map((indexName) => {
        const idx = store.index(indexName);
        return {
          name: idx.name,
          keyPath: idx.keyPath,
          unique: idx.unique,
          multiEntry: idx.multiEntry,
        };
      });

      const entries = await this.dumpStoreEntries(store);
      stores[storeName] = {
        keyPath: store.keyPath,
        autoIncrement: store.autoIncrement,
        indexes,
        entries,
      };
    }

    await this.waitTransaction(tx);
    const version = db.version;
    db.close();

    return {
      name: dbName,
      version,
      stores,
    };
  }

  private dumpStoreEntries(
    store: IDBObjectStore
  ): Promise<Array<{ key: IDBValidKey; value: unknown }>> {
    return new Promise((resolve, reject) => {
      const entries: Array<{ key: IDBValidKey; value: unknown }> = [];
      const req = store.openCursor();
      req.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (!cursor) {
          resolve(entries);
          return;
        }
        entries.push({ key: cursor.primaryKey, value: cursor.value });
        cursor.continue();
      };
      req.onerror = () => reject(req.error || new Error("failed to read store"));
    });
  }

  private openDatabase(dbName: string): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("failed to open db"));
    });
  }

  private openDatabaseWithSchema(def: BackupDbDef): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(def.name, def.version || 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const [storeName, storeDef] of Object.entries(def.stores)) {
          let store: IDBObjectStore;
          if (!db.objectStoreNames.contains(storeName)) {
            store = db.createObjectStore(storeName, {
              keyPath: storeDef.keyPath,
              autoIncrement: storeDef.autoIncrement,
            });
          } else {
            const tx = req.transaction;
            if (!tx) {
              throw new Error("missing upgrade transaction");
            }
            store = tx.objectStore(storeName);
          }

          for (const index of storeDef.indexes || []) {
            if (!store.indexNames.contains(index.name)) {
              store.createIndex(index.name, index.keyPath, {
                unique: index.unique,
                multiEntry: index.multiEntry,
              });
            }
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("failed to create db"));
    });
  }

  private deleteDatabaseIfExists(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error(`failed to delete ${name}`));
      req.onblocked = () => resolve();
    });
  }

  private waitTransaction(tx: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("transaction failed"));
      tx.onabort = () => reject(tx.error || new Error("transaction aborted"));
    });
  }
}

class CookieStatusPresenter {
  constructor(
    private readonly container: HTMLElement,
    private readonly getLanguage: () => string
  ) {}

  render(cookies: CookieViewModel[]): void {
    this.container.innerHTML = "";
    cookies.forEach((cookie) => {
      const row = document.createElement("div");
      row.className = "cookie-row";

      const name = document.createElement("div");
      name.textContent = cookie.name;

      const status = document.createElement("div");
      if (cookie.value) {
        status.className = "status-ok";
        status.textContent = t(this.getLanguage(), "cookieStatusOk", {
          date: this.formatExpiration(cookie),
        });
      } else {
        status.className = "status-missing";
        status.textContent = t(this.getLanguage(), "cookieStatusMissing");
      }

      row.appendChild(name);
      row.appendChild(status);
      this.container.appendChild(row);
    });
  }

  private formatExpiration(cookie: CookieViewModel): string {
    if (!cookie.expirationDate) {
      return "-";
    }
    const date = new Date(cookie.expirationDate * 1000);
    return date.toLocaleString(getLocaleForLanguage(this.getLanguage()));
  }
}

class OptionsPageController {
  private readonly cookieNames = ["POESESSID"];
  private currentLanguage = "en";

  private readonly cookieListElement: HTMLElement;
  private readonly refreshButton: HTMLButtonElement;
  private readonly exportButton: HTMLButtonElement;
  private readonly importButton: HTMLButtonElement;
  private readonly backupStatus: HTMLElement;
  private readonly cookieService: CookieService;
  private readonly backupService: BackupService;
  private readonly presenter: CookieStatusPresenter;

  constructor() {
    const cookieList = document.getElementById("cookie-list");
    const refreshButton = document.getElementById("refresh-cookies");
    const exportButton = document.getElementById("export-backup");
    const importButton = document.getElementById("import-backup");
    const backupStatus = document.getElementById("backup-status");

    if (!(cookieList instanceof HTMLElement)) {
      throw new Error("cookie list element not found");
    }
    if (!(refreshButton instanceof HTMLButtonElement)) {
      throw new Error("refresh button element not found");
    }
    if (!(exportButton instanceof HTMLButtonElement)) {
      throw new Error("export button element not found");
    }
    if (!(importButton instanceof HTMLButtonElement)) {
      throw new Error("import button element not found");
    }
    if (!(backupStatus instanceof HTMLElement)) {
      throw new Error("backup status element not found");
    }

    this.cookieListElement = cookieList;
    this.refreshButton = refreshButton;
    this.exportButton = exportButton;
    this.importButton = importButton;
    this.backupStatus = backupStatus;
    this.cookieService = new CookieService(() => this.currentLanguage);
    this.backupService = new BackupService();
    this.presenter = new CookieStatusPresenter(this.cookieListElement, () => this.currentLanguage);
  }

  async init(): Promise<void> {
    this.refreshButton.addEventListener("click", () => {
      void this.loadCookies();
    });
    this.exportButton.addEventListener("click", () => {
      void this.handleExport();
    });
    this.importButton.addEventListener("click", () => {
      void this.handleImport();
    });

    const storedLanguage = await loadUiLanguage();
    this.currentLanguage = normalizeLanguage(storedLanguage);
    this.applyLanguage();
    await this.loadCookies();

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes.uiLanguage) {
        return;
      }
      const nextLanguage = normalizeLanguage(String(changes.uiLanguage.newValue || "en"));
      this.currentLanguage = nextLanguage;
      this.applyLanguage();
      void this.loadCookies();
    });
  }

  private applyLanguage(): void {
    document.documentElement.lang = this.currentLanguage;
    applyTranslations(document, this.currentLanguage);
  }

  private setBackupStatus(message: string, isError = false): void {
    this.backupStatus.textContent = message;
    this.backupStatus.classList.toggle("status-missing", isError);
    this.backupStatus.classList.toggle("status-ok", !isError && message.length > 0);
  }

  private async handleExport(): Promise<void> {
    this.setBusy(this.exportButton, true);
    try {
      this.setBackupStatus("");
      const payload = await this.backupService.exportBackup();
      this.backupService.downloadBackup(payload);
      this.setBackupStatus(t(this.currentLanguage, "backupDone"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      this.setBackupStatus(t(this.currentLanguage, "backupFailed", { message }), true);
    } finally {
      this.setBusy(this.exportButton, false);
    }
  }

  private async handleImport(): Promise<void> {
    this.setBusy(this.importButton, true);
    try {
      this.setBackupStatus("");
      const payload = await this.backupService.pickBackupFile();
      if (
        !confirm(
          t(this.currentLanguage, "backupConfirmImport", { extensionId: payload.extensionId })
        )
      ) {
        return;
      }
      // Why: importing overwrites local extension data by design, so we keep it behind
      // explicit user confirmation to avoid accidental data loss.
      await this.backupService.importBackup(payload);
      this.setBackupStatus(t(this.currentLanguage, "backupDone"));
      await this.loadCookies();
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      this.setBackupStatus(t(this.currentLanguage, "backupFailed", { message }), true);
    } finally {
      this.setBusy(this.importButton, false);
    }
  }

  private setBusy(button: HTMLButtonElement, busy: boolean): void {
    button.disabled = busy;
    button.toggleAttribute("aria-busy", busy);
  }

  private async loadCookies(): Promise<void> {
    const results = await Promise.all(
      this.cookieNames.map((name) => this.cookieService.getCookie(name))
    );
    const viewModels: CookieViewModel[] = this.cookieNames.map((name, index) => ({
      name,
      value: results[index]?.value || null,
      expirationDate: results[index]?.expirationDate || null,
    }));
    this.presenter.render(viewModels);
  }
}

const controller = new OptionsPageController();
// Why: Startup failures on options page should still be visible in console instead of
// silently failing and showing stale cookie state.
void controller.init();
