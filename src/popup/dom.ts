import type { PopupDom } from "./types.js";

function requireElement<T extends Element>(id: string, ctor: { new (): T }): T {
  const element = document.getElementById(id);
  if (!(element instanceof ctor)) {
    throw new Error(`required element not found or invalid: ${id}`);
  }
  return element;
}

export function getPopupDom(): PopupDom {
  // Why: fail-fast here keeps runtime errors near bootstrap instead of scattered null checks.
  return {
    purchasePendingCount: requireElement("purchase-pending-count", HTMLElement),
    purchasePendingList: requireElement("purchase-pending-list", HTMLUListElement),
    leagueSelect: requireElement("league-select", HTMLSelectElement),
    refreshButton: requireElement("refresh-btn", HTMLButtonElement),
    languageSelect: requireElement("language-select", HTMLSelectElement),
    totalsContainer: requireElement("totals", HTMLElement),
    historyBody: requireElement("history-body", HTMLTableSectionElement),
    searchInput: requireElement("search-input", HTMLInputElement),
    pageSizeSelect: requireElement("page-size", HTMLSelectElement),
    csvExportButton: requireElement("csv-export", HTMLButtonElement),
    prevPageButton: requireElement("prev-page", HTMLButtonElement),
    nextPageButton: requireElement("next-page", HTMLButtonElement),
    pageInfo: requireElement("page-info", HTMLElement),
    modal: requireElement("modal", HTMLDialogElement),
    modalTitle: requireElement("modal-title", HTMLElement),
    modalMessage: requireElement("modal-message", HTMLElement),
    modalClose: requireElement("modal-close", HTMLButtonElement),
    detailModal: requireElement("detail-modal", HTMLDialogElement),
    detailClose: requireElement("detail-close", HTMLButtonElement),
    detailTitle: requireElement("detail-title", HTMLElement),
    detailSubtitle: requireElement("detail-subtitle", HTMLElement),
    detailBody: requireElement("detail-body", HTMLElement),
    detailCard: requireElement("detail-card", HTMLElement),
    chartCanvas: requireElement("sales-chart", HTMLCanvasElement),
    chartSection: requireElement("sales-chart-section", HTMLElement),
  };
}
