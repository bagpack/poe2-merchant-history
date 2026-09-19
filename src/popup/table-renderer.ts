import { t } from "../i18n.js";
import { formatAmount, formatDateTime, formatItemName, getCurrencyIcon } from "./formatters.js";
import type { Language, PopupDom, TradeRecord } from "./types.js";

export class TableRenderer {
  constructor(
    private readonly dom: PopupDom,
    private readonly languageProvider: () => Language,
    private readonly onSelectRecord: (record: TradeRecord) => void,
    private readonly pageProvider: () => number,
    private readonly pageSetter: (page: number) => void
  ) {}

  applyFilters(records: TradeRecord[]): TradeRecord[] {
    const query = this.dom.searchInput.value.trim().toLowerCase();
    if (!query) {
      return records;
    }
    return records.filter((record) => formatItemName(record).toLowerCase().includes(query));
  }

  renderTable(records: TradeRecord[]): void {
    this.dom.historyBody.innerHTML = "";
    const pageSize = Number(this.dom.pageSizeSelect.value);
    const filtered = this.applyFilters(records);
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    this.pageSetter(Math.min(this.pageProvider(), totalPages));

    const start = (this.pageProvider() - 1) * pageSize;
    const pageRecords = filtered.slice(start, start + pageSize);

    if (filtered.length === 0) {
      const row = document.createElement("tr");
      const message = createCell(
        t(this.languageProvider(), records.length ? "salesNoMatches" : "salesEmpty")
      );
      message.colSpan = 4;
      row.append(message);
      this.dom.historyBody.append(row);
    }
    pageRecords.forEach((record) => {
      const row = document.createElement("tr");
      const displayName = formatItemName(record);
      const itemCell = document.createElement("td");
      const detailButton = document.createElement("button");
      detailButton.type = "button";
      detailButton.className = "item-detail-trigger";
      detailButton.textContent = displayName;
      detailButton.setAttribute("aria-haspopup", "dialog");
      detailButton.addEventListener("click", () => this.onSelectRecord(record));
      itemCell.appendChild(detailButton);
      row.append(
        createCell(formatDateTime(record.time, this.languageProvider())),
        itemCell,
        createCurrencyCell(record.currency),
        createCell(formatAmount(Number(record.amount ?? 0), this.languageProvider()))
      );
      this.dom.historyBody.appendChild(row);
    });

    this.dom.pageInfo.textContent = `${this.pageProvider()} / ${totalPages}`;
    this.dom.prevPageButton.disabled = this.pageProvider() <= 1;
    this.dom.nextPageButton.disabled = this.pageProvider() >= totalPages;
  }
}

function createCurrencyCell(currency: string | null | undefined): HTMLTableCellElement {
  const cell = document.createElement("td");
  const value = document.createElement("span");
  value.className = "currency-value";
  const iconUrl = currency ? getCurrencyIcon(currency) : null;
  if (iconUrl) {
    const icon = document.createElement("img");
    icon.src = iconUrl;
    icon.alt = "";
    value.append(icon);
  }
  value.append(currency ?? "");
  cell.append(value);
  return cell;
}

function createCell(value: unknown): HTMLTableCellElement {
  const cell = document.createElement("td");
  cell.textContent = value === null || value === undefined ? "" : String(value);
  return cell;
}
