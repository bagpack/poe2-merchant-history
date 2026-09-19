import {
  applyTranslations,
  getLocaleForLanguage,
  loadUiLanguage,
  saveUiLanguage,
  t,
} from "./i18n.js";
import { buildPurchaseCsv, buildPurchaseJson } from "./purchase/export.js";
import {
  loadPurchaseHistoryFilterPreferences,
  savePurchaseHistoryFilterPreferences,
} from "./purchase/filter-preferences.js";
import { isPurchaseHistoryChangedMessage } from "./purchase/messages.js";
import type { PurchaseRecord, PurchaseStatus, PurchaseUndoAction } from "./purchase/types.js";
import type { PurchaseHistoryFilterPreferences } from "./purchase/filter-preferences.js";
import { getUndoProgress, getUndoSecondsRemaining } from "./purchase/undo.js";
import { DetailRenderer } from "./popup/detail-renderer.js";
import type { ItemDetails, Language } from "./popup/types.js";

const compactLayout = window.matchMedia("(width < 1260px)");
const advancedFilters = requireElement("purchase-advanced-filters", HTMLDetailsElement);
const dateError = requireElement("purchase-date-error", HTMLElement);
const resultCount = requireElement("purchase-result-count", HTMLElement);
const body = requireElement("purchase-history-body", HTMLDivElement);
const empty = requireElement("purchase-empty", HTMLElement);
const listWrapper = requireElement("purchase-list-wrapper", HTMLElement);
const pageStatus = requireElement("purchase-status", HTMLElement);
const undoNotice = requireElement("purchase-undo", HTMLElement);
const undoProgress = requireElement("purchase-undo-progress", SVGCircleElement);
const undoSeconds = requireElement("purchase-undo-seconds", HTMLElement);
const undoMessage = requireElement("purchase-undo-message", HTMLElement);
const undoRemaining = requireElement("purchase-undo-remaining", HTMLElement);
const undoButton = requireElement("purchase-undo-button", HTMLButtonElement);
const deleteAllButton = requireElement("delete-all-purchases", HTMLButtonElement);
const statusFilter = requireElement("purchase-status-filter", HTMLSelectElement);
const leagueFilter = requireElement("purchase-league-filter", HTMLSelectElement);
const searchInput = requireElement("purchase-search", HTMLInputElement);
const dateFrom = requireElement("purchase-date-from", HTMLInputElement);
const dateTo = requireElement("purchase-date-to", HTMLInputElement);
const clearFiltersButton = requireElement("clear-purchase-filters", HTMLButtonElement);
const languageSelect = requireElement("purchase-language", HTMLSelectElement);
const detailModal = requireElement("detail-modal", HTMLDialogElement);
const detailRenderer = new DetailRenderer(
  {
    detailModal,
    detailClose: requireElement("detail-close", HTMLButtonElement),
    detailTitle: requireElement("detail-title", HTMLElement),
    detailSubtitle: requireElement("detail-subtitle", HTMLElement),
    detailBody: requireElement("detail-body", HTMLElement),
    detailCard: requireElement("detail-card", HTMLElement),
  },
  () => language
);

let records: PurchaseRecord[] = [];
let language: Language = "en";
let filterPreferences: PurchaseHistoryFilterPreferences = {
  status: "",
  itemName: "",
  league: "",
  dateFrom: "",
  dateTo: "",
};
let undoAction: PurchaseUndoAction | null = null;
type UndoMessageKey = "purchaseUndoMarkedPurchased" | "purchaseUndoDeleted";
let undoMessageKey: UndoMessageKey = "purchaseUndoDeleted";
let undoTimerId: number | null = null;
let undoHideTimerId: number | null = null;

void init();

async function init(): Promise<void> {
  language = await loadUiLanguage();
  filterPreferences = await loadPurchaseHistoryFilterPreferences();
  languageSelect.value = language;
  applyLanguage();
  bindEvents();
  advancedFilters.open = Boolean(
    filterPreferences.league || filterPreferences.dateFrom || filterPreferences.dateTo
  );
  try {
    await refresh();
    const latestUndo = await request<PurchaseUndoAction | null>({ type: "purchase/undo-current" });
    if (latestUndo) {
      showUndo(latestUndo);
    }
  } catch {
    setPageStatus("purchaseActionFailed", true);
  }
}

function bindEvents(): void {
  compactLayout.addEventListener("change", () => {
    if (!detailModal.open) render();
  });
  chrome.runtime.onMessage.addListener((message: unknown) => {
    if (!isPurchaseHistoryChangedMessage(message)) {
      return;
    }
    if (undoAction && message.undoToken !== undoAction.token) {
      hideUndoNotice();
    }
    void refresh().catch(() => setPageStatus("purchaseActionFailed", true));
  });
  searchInput.addEventListener("input", handleFilterChange);
  dateFrom.addEventListener("input", handleFilterChange);
  dateTo.addEventListener("input", handleFilterChange);
  statusFilter.addEventListener("change", handleFilterChange);
  leagueFilter.addEventListener("change", handleFilterChange);
  clearFiltersButton.addEventListener("click", () => {
    filterPreferences = { status: "", itemName: "", league: "", dateFrom: "", dateTo: "" };
    restoreFilterPreferences();
    void savePurchaseHistoryFilterPreferences(filterPreferences).catch(() => undefined);
    render();
  });
  languageSelect.addEventListener("change", async () => {
    language = languageSelect.value === "ja" ? "ja" : "en";
    await saveUiLanguage(language);
    applyLanguage();
    pageStatus.textContent = "";
    renderFilterOptions();
    restoreFilterPreferences();
    render();
  });
  body.addEventListener("click", (event) => void handleRowAction(event));
  undoButton.addEventListener("click", () => void undoLastAction());
  requireElement("export-purchase-csv", HTMLButtonElement).addEventListener("click", () =>
    download("poe2-purchase-history.csv", buildPurchaseCsv(filteredRecords()), "text/csv")
  );
  requireElement("export-purchase-json", HTMLButtonElement).addEventListener("click", () =>
    download("poe2-purchase-history.json", buildPurchaseJson(filteredRecords()), "application/json")
  );
  deleteAllButton.addEventListener("click", async () => {
    if (!confirm(t(language, "purchaseConfirmDeleteAll", { count: records.length }))) {
      return;
    }
    await runMutation(
      deleteAllButton,
      () => request({ type: "purchase/delete-all" }),
      "purchaseDeletedAll"
    );
  });
}

async function refresh(): Promise<void> {
  records = await request<PurchaseRecord[]>({ type: "purchase/list" });
  renderFilterOptions();
  restoreFilterPreferences();
  render();
}

function handleFilterChange(event: Event): void {
  filterPreferences = readFilterPreferences(event.currentTarget !== leagueFilter);
  void savePurchaseHistoryFilterPreferences(filterPreferences).catch(() => undefined);
  render();
}

function readFilterPreferences(
  preserveUnavailableLeague = false
): PurchaseHistoryFilterPreferences {
  const hasSavedLeagueOption = Array.from(leagueFilter.options).some(
    (option) => option.value === filterPreferences.league
  );
  return {
    status:
      statusFilter.value === "pending" || statusFilter.value === "purchased"
        ? statusFilter.value
        : "",
    itemName: searchInput.value,
    league:
      preserveUnavailableLeague && filterPreferences.league && !hasSavedLeagueOption
        ? filterPreferences.league
        : leagueFilter.value,
    dateFrom: dateFrom.value,
    dateTo: dateTo.value,
  };
}

function restoreFilterPreferences(): void {
  statusFilter.value = filterPreferences.status;
  searchInput.value = filterPreferences.itemName;
  dateFrom.value = filterPreferences.dateFrom;
  dateTo.value = filterPreferences.dateTo;
  leagueFilter.value = Array.from(leagueFilter.options).some(
    (option) => option.value === filterPreferences.league
  )
    ? filterPreferences.league
    : "";
}

function renderFilterOptions(): void {
  const currentStatus = statusFilter.value;
  const currentLeague = leagueFilter.value;
  setOptions(statusFilter, [
    ["", t(language, "purchaseFilterAll")],
    ...(["pending", "purchased"] as PurchaseStatus[]).map(
      (status) => [status, statusLabel(status)] as [string, string]
    ),
  ]);
  setOptions(leagueFilter, [
    ["", t(language, "purchaseFilterAll")],
    ...[...new Set(records.map((record) => record.league).filter(Boolean))]
      .sort()
      .map((league) => [league as string, league as string] as [string, string]),
  ]);
  statusFilter.value = currentStatus;
  leagueFilter.value = currentLeague;
}

function render(): void {
  const invalidDates = Boolean(dateFrom.value && dateTo.value && dateFrom.value > dateTo.value);
  dateError.hidden = !invalidDates;
  dateError.textContent = invalidDates ? t(language, "purchaseDateInvalid") : "";
  for (const input of [dateFrom, dateTo]) input.setAttribute("aria-invalid", String(invalidDates));
  if (invalidDates) advancedFilters.open = true;
  const visible = invalidDates ? [] : filteredRecords();
  resultCount.textContent = t(language, "purchaseResultCount", {
    visible: visible.length,
    total: records.length,
  });
  for (const id of ["export-purchase-csv", "export-purchase-json"]) {
    requireElement(id, HTMLButtonElement).disabled = invalidDates || visible.length === 0;
  }
  const list = listWrapper.querySelector(".purchase-list")!;
  list.setAttribute("role", compactLayout.matches ? "list" : "table");
  body.setAttribute("role", compactLayout.matches ? "presentation" : "rowgroup");
  listWrapper
    .querySelector(".purchase-list-header")!
    .setAttribute("aria-hidden", String(compactLayout.matches));
  body.replaceChildren(...visible.map(renderRow));
  empty.hidden = invalidDates || visible.length !== 0;
  empty.textContent = t(language, records.length === 0 ? "purchaseEmpty" : "purchaseNoMatches");
  listWrapper.hidden = visible.length === 0;
  deleteAllButton.disabled = records.length === 0;
  clearFiltersButton.disabled = !Object.values(filterPreferences).some(Boolean);
}

function filteredRecords(): PurchaseRecord[] {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const from = dateFrom.value ? new Date(`${dateFrom.value}T00:00:00`).getTime() : null;
  const to = dateTo.value ? new Date(`${dateTo.value}T23:59:59.999`).getTime() : null;
  return records.filter(
    (record) =>
      (!statusFilter.value || record.status === statusFilter.value) &&
      (!leagueFilter.value || record.league === leagueFilter.value) &&
      (!query || record.summary.displayName.toLocaleLowerCase().includes(query)) &&
      (from === null || record.candidateAt >= from) &&
      (to === null || record.candidateAt <= to)
  );
}

function renderRow(record: PurchaseRecord): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "purchase-row";
  row.setAttribute("role", "row");
  row.dataset.id = record.id;
  if (compactLayout.matches) {
    row.append(
      itemCell(record),
      cell(statusLabel(record.status), "status", "purchaseColumnStatus"),
      cell(formatPrice(record), "price-cell", "purchaseColumnPrice"),
      actionCell(record),
      recordMetadata(record)
    );
    row.setAttribute("role", "listitem");
    for (const child of Array.from(row.children)) child.removeAttribute("role");
    return row;
  }
  row.append(
    itemCell(record),
    cell(statusLabel(record.status), "status", "purchaseColumnStatus"),
    cell(formatDate(record.candidateAt), undefined, "purchaseColumnCandidateAt"),
    cell(formatDate(record.purchasedAt), undefined, "purchaseColumnPurchasedAt"),
    cell(formatPrice(record), undefined, "purchaseColumnPrice"),
    cell(record.listingSnapshot.sellerAccount, undefined, "purchaseColumnSeller"),
    cell(record.league, undefined, "purchaseColumnLeague"),
    linkCell(record.source.pageUrl),
    actionCell(record)
  );
  return row;
}

function recordMetadata(record: PurchaseRecord): HTMLDivElement {
  const target = cell("", "record-metadata");
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = t(language, "purchaseRecordMetadata");
  const list = document.createElement("dl");
  for (const [key, value] of [
    ["purchaseColumnCandidateAt", formatDate(record.candidateAt)],
    ["purchaseColumnPurchasedAt", formatDate(record.purchasedAt)],
    ["purchaseColumnSeller", record.listingSnapshot.sellerAccount ?? "—"],
    ["purchaseColumnLeague", record.league ?? "—"],
  ]) {
    const term = document.createElement("dt");
    term.textContent = t(language, key);
    const description = document.createElement("dd");
    description.textContent = value;
    list.append(term, description);
  }
  const source = linkCell(record.source.pageUrl);
  source.removeAttribute("role");
  details.append(summary, list, source);
  target.append(details);
  return target;
}

function itemCell(record: PurchaseRecord): HTMLDivElement {
  const target = cell(null, "item-cell");
  target.dataset.label = t(language, "purchaseColumnItem");
  const detailButton = actionButton("detail", record.summary.displayName);
  detailButton.className = "item-detail-trigger";
  detailButton.setAttribute("aria-haspopup", "dialog");
  target.replaceChildren(detailButton);
  return target;
}

function actionCell(record: PurchaseRecord): HTMLDivElement {
  const target = cell("", "actions");
  target.dataset.label = t(language, "purchaseColumnActions");
  if (record.status === "pending") {
    target.append(actionButton("purchased", t(language, "purchaseMarkPurchased")));
  }
  target.append(
    actionButton(
      "delete",
      t(
        language,
        record.status === "pending" ? "purchaseDeleteCandidate" : "purchaseDeleteHistory"
      ),
      true
    )
  );
  return target;
}

async function handleRowAction(event: Event): Promise<void> {
  const button =
    event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>("button[data-action]")
      : null;
  const row = button?.closest(".purchase-row[data-id]");
  const id = row?.getAttribute("data-id");
  const action = button?.getAttribute("data-action");
  if (!button || !id || !action) {
    return;
  }
  if (action === "detail") {
    const record = records.find((candidate) => candidate.id === id);
    if (record) {
      detailRenderer.showItem(record.rawItem as ItemDetails, record.summary.displayName);
    }
    return;
  }
  if (action === "delete") {
    await runMutation(button, () => request({ type: "purchase/delete", id }), "purchaseDeleted");
    return;
  }
  if (action === "purchased") {
    await runMutation(
      button,
      () => request({ type: "purchase/mark-purchased", id }),
      "purchaseMarkedPurchased"
    );
  }
}

async function runMutation(
  button: HTMLButtonElement,
  mutate: () => Promise<unknown>,
  successKey: string
): Promise<void> {
  if (button.disabled) {
    return;
  }
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  setPageStatus("purchaseProcessing");
  try {
    const result = await mutate();
    await refresh();
    if (isUndoableMutationResult(result)) {
      showUndo(result.undo, true);
    }
    setPageStatus(successKey);
  } catch {
    setPageStatus("purchaseActionFailed", true);
  } finally {
    button.removeAttribute("aria-busy");
    if (button.isConnected) {
      button.disabled = button === deleteAllButton && records.length === 0;
    }
  }
}

async function undoLastAction(): Promise<void> {
  const action = undoAction;
  if (!action || undoButton.disabled) {
    return;
  }
  undoButton.disabled = true;
  undoButton.setAttribute("aria-busy", "true");
  setPageStatus("purchaseProcessing");
  try {
    await request({ type: "purchase/undo", token: action.token });
    await refresh();
    hideUndoNotice();
    setPageStatus("purchaseUndone");
  } catch {
    if (getUndoSecondsRemaining(action.expiresAt) === 0) {
      expireUndo();
    } else {
      setPageStatus("purchaseActionFailed", true);
    }
  } finally {
    undoButton.removeAttribute("aria-busy");
    if (undoAction) {
      undoButton.disabled = false;
    }
  }
}

function showUndo(action: PurchaseUndoAction, moveFocus = false): void {
  clearUndoTimers();
  undoAction = action;
  undoMessageKey =
    action.type === "mark-purchased" ? "purchaseUndoMarkedPurchased" : "purchaseUndoDeleted";
  undoButton.hidden = false;
  undoButton.disabled = false;
  undoNotice.hidden = false;
  document.documentElement.classList.add("has-undo");
  renderUndoNotice();
  if (moveFocus) {
    undoButton.focus({ preventScroll: true });
  }
  undoTimerId = window.setInterval(updateUndoCountdown, 250);
}

function updateUndoCountdown(): void {
  if (!undoAction) {
    return;
  }
  if (getUndoSecondsRemaining(undoAction.expiresAt) === 0) {
    expireUndo();
    return;
  }
  renderUndoNotice();
}

function renderUndoNotice(): void {
  if (!undoAction) {
    return;
  }
  const now = Date.now();
  const progress = getUndoProgress(undoAction.expiresAt, now);
  const seconds = getUndoSecondsRemaining(undoAction.expiresAt, now);
  const itemName = undoAction.previousRecord.summary.displayName;
  undoProgress.style.setProperty("--undo-progress", String(progress));
  undoSeconds.textContent = String(seconds);
  undoMessage.textContent = t(language, undoMessageKey, { item: itemName });
  undoRemaining.textContent = t(language, "purchaseUndoRemaining", { seconds });
  undoButton.textContent = t(language, "purchaseUndo");
  undoButton.setAttribute("aria-label", t(language, "purchaseUndoButtonLabel", { item: itemName }));
}

function expireUndo(): void {
  clearUndoTimers();
  if (document.activeElement === undoButton) focusRecord();
  undoAction = null;
  undoProgress.style.setProperty("--undo-progress", "0");
  undoSeconds.textContent = "—";
  undoRemaining.textContent = "—";
  undoMessage.textContent = t(language, "purchaseUndoExpired");
  undoButton.hidden = true;
  undoButton.disabled = true;
  setPageStatus("purchaseUndoExpired");
  undoHideTimerId = window.setTimeout(() => {
    undoNotice.hidden = true;
    document.documentElement.classList.remove("has-undo");
  }, 3000);
}

function focusRecord(): void {
  const id = undoAction?.recordId;
  const row = Array.from(body.children).find((element) => element.getAttribute("data-id") === id);
  const target = row?.querySelector<HTMLButtonElement>("button") ?? searchInput;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "nearest" });
}

function hideUndoNotice(): void {
  if (document.activeElement === undoButton) focusRecord();
  document.documentElement.classList.remove("has-undo");
  clearUndoTimers();
  undoAction = null;
  undoNotice.hidden = true;
  undoButton.hidden = false;
  undoSeconds.textContent = "—";
  undoRemaining.textContent = "";
}

function clearUndoTimers(): void {
  if (undoTimerId !== null) {
    window.clearInterval(undoTimerId);
    undoTimerId = null;
  }
  if (undoHideTimerId !== null) {
    window.clearTimeout(undoHideTimerId);
    undoHideTimerId = null;
  }
}

function isUndoableMutationResult(value: unknown): value is { undo: PurchaseUndoAction } {
  if (!isRecord(value) || !Object.hasOwn(value, "undo") || !isRecord(value.undo)) {
    return false;
  }
  return typeof value.undo.token === "string" && typeof value.undo.expiresAt === "number";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function setPageStatus(key: string, isError = false): void {
  pageStatus.textContent = t(language, key);
  pageStatus.classList.toggle("is-error", isError);
}

function applyLanguage(): void {
  document.documentElement.lang = language;
  applyTranslations(document, language);
  if (!undoNotice.hidden && undoAction) {
    renderUndoNotice();
  }
}

function statusLabel(status: PurchaseStatus): string {
  return t(language, `purchaseStatus${status[0].toUpperCase()}${status.slice(1)}`);
}

function formatDate(value: number | null): string {
  return value === null
    ? "—"
    : new Intl.DateTimeFormat(getLocaleForLanguage(language), {
        dateStyle: "short",
        timeStyle: "short",
      }).format(value);
}

function formatPrice(record: PurchaseRecord): string {
  const price = record.listingSnapshot.price;
  return price ? `${price.amount} ${price.currency}` : "—";
}

function cell(value: unknown, className?: string, labelKey?: string): HTMLDivElement {
  const target = document.createElement("div");
  target.setAttribute("role", "cell");
  target.classList.add("purchase-cell");
  target.textContent = value === null || value === undefined ? "—" : String(value);
  if (className) {
    target.classList.add(className);
  }
  if (labelKey) {
    target.dataset.label = t(language, labelKey);
  }
  return target;
}

function linkCell(url: string): HTMLDivElement {
  const target = cell(null);
  target.dataset.label = t(language, "purchaseColumnSearch");
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = t(language, "purchaseOpenSearch");
  target.replaceChildren(link);
  return target;
}

function actionButton(action: string, label: string, danger = false): HTMLButtonElement {
  const button = document.createElement("button");
  button.dataset.action = action;
  button.textContent = label;
  button.classList.toggle("danger", danger);
  return button;
}

function setOptions(select: HTMLSelectElement, values: Array<[string, string]>): void {
  select.replaceChildren(
    ...values.map(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    })
  );
}

async function request<T = null>(message: unknown): Promise<T> {
  const response = (await chrome.runtime.sendMessage(message)) as {
    ok?: boolean;
    data?: T;
    error?: { message?: string };
  };
  if (!response?.ok) {
    throw new Error(response?.error?.message ?? "Purchase history request failed.");
  }
  return response.data as T;
}

function download(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function requireElement<T extends Element>(id: string, ctor: { new (): T }): T {
  const element = document.getElementById(id);
  if (!(element instanceof ctor)) {
    throw new Error(`required element not found or invalid: ${id}`);
  }
  return element;
}
