import { applyTranslations, loadUiLanguage, normalizeLanguage, t } from "../i18n.js";
import { migrateLegacyDbIfNeeded } from "../shared.js";
import { isPurchaseHistoryChangedMessage } from "../purchase/messages.js";
import { ChartService } from "./chart-service.js";
import { DetailRenderer } from "./detail-renderer.js";
import { getPopupDom } from "./dom.js";
import { buildCsv, buildCsvFilename, downloadCsv, formatDateKey } from "./formatters.js";
import { HistoryService } from "./history-service.js";
import { PopupState } from "./state.js";
import { TableRenderer } from "./table-renderer.js";
import type { HistoryErrorMeta, Language, LeagueOption, TradeRecord } from "./types.js";
import type { PurchaseRecord } from "../purchase/types.js";

export class PopupApp {
  private readonly dom = getPopupDom();
  private modalPreviousFocus: HTMLElement | null = null;
  private readonly state = new PopupState();
  private readonly historyService = new HistoryService(() => this.state.getCurrentLanguage());
  private readonly detailRenderer = new DetailRenderer(this.dom, () =>
    this.state.getCurrentLanguage()
  );
  private readonly tableRenderer = new TableRenderer(
    this.dom,
    () => this.state.getCurrentLanguage(),
    (record) => this.detailRenderer.showDetail(record),
    () => this.state.getCurrentPage(),
    (page) => this.state.setCurrentPage(page)
  );
  private readonly chartService = new ChartService(
    this.dom.salesRail,
    this.dom.chartDataBody,
    this.dom.daySummary
  );
  private selectedDate: string | null = null;

  async init(): Promise<void> {
    this.bindEvents();

    try {
      const storedLanguage = await loadUiLanguage();
      this.applyLanguage(storedLanguage);
      await this.refreshPurchaseSummary();

      const leagues = await this.historyService.loadLeagues();
      this.setOptions(leagues);
      const stored = await this.historyService.loadSelectedLeague();
      if (stored && leagues.some((league) => league.id === stored)) {
        this.dom.leagueSelect.value = stored;
      }
      const storedPageSize = await this.historyService.loadPageSize();
      if (storedPageSize) {
        this.dom.pageSizeSelect.value = String(storedPageSize);
      }
    } catch (_error) {
      this.showModal(
        t(this.state.getCurrentLanguage(), "modalErrorTitle"),
        t(this.state.getCurrentLanguage(), "modalLeagueFetchFailed")
      );
    }

    if (this.dom.leagueSelect.value) {
      await migrateLegacyDbIfNeeded(this.dom.leagueSelect.value);
      await this.refreshData(this.dom.leagueSelect.value);
    }
  }

  private bindEvents(): void {
    chrome.runtime.onMessage.addListener((message: unknown) => {
      if (!isPurchaseHistoryChangedMessage(message)) {
        return;
      }
      void this.refreshPurchaseSummary();
    });
    this.dom.modal.addEventListener("close", () => {
      const target = this.modalPreviousFocus;
      if (target?.isConnected && !target.matches(":disabled")) target.focus();
      else this.dom.refreshButton.focus();
    });
    this.dom.modalClose.addEventListener("click", () => this.hideModal());
    this.dom.modal.addEventListener("click", (event) => {
      if (event.target === this.dom.modal) {
        this.hideModal();
      }
    });
    this.dom.leagueSelect.addEventListener("change", async () => {
      this.historyService.storeSelectedLeague(this.dom.leagueSelect.value);
      this.selectedDate = null;
      this.state.setCurrentPage(1);
      await migrateLegacyDbIfNeeded(this.dom.leagueSelect.value);
      await this.refreshData(this.dom.leagueSelect.value);
    });

    this.dom.refreshButton.addEventListener("click", async () => this.handleUpdate());

    this.dom.csvExportButton.addEventListener("click", () => this.handleCsvExport());

    this.dom.salesRail.addEventListener("click", (event) => {
      const frame =
        event.target instanceof Element
          ? event.target.closest<HTMLButtonElement>("[data-date]")
          : null;
      if (frame?.dataset.date) this.selectDate(frame.dataset.date);
    });
    this.dom.showAllDatesButton.addEventListener("click", () => this.selectDate(null));

    this.dom.searchInput.addEventListener("input", () => {
      this.state.setCurrentPage(1);
      this.tableRenderer.renderTable(this.getVisibleRecords());
    });

    this.dom.pageSizeSelect.addEventListener("change", () => {
      this.historyService.storePageSize(this.dom.pageSizeSelect.value);
      this.state.setCurrentPage(1);
      this.tableRenderer.renderTable(this.getVisibleRecords());
    });

    this.dom.prevPageButton.addEventListener("click", () => {
      this.state.setCurrentPage(this.state.getCurrentPage() - 1);
      this.tableRenderer.renderTable(this.getVisibleRecords());
    });

    this.dom.nextPageButton.addEventListener("click", () => {
      this.state.setCurrentPage(this.state.getCurrentPage() + 1);
      this.tableRenderer.renderTable(this.getVisibleRecords());
    });
  }

  private async refreshPurchaseSummary(): Promise<void> {
    let pending: PurchaseRecord[] = [];
    const errorNotice = document.getElementById("purchase-pending-error")!;
    errorNotice.hidden = true;
    try {
      const response = (await chrome.runtime.sendMessage({ type: "purchase/list" })) as {
        ok?: boolean;
        data?: PurchaseRecord[];
      };
      if (!response?.ok) throw new Error("Purchase summary unavailable");
      pending = (response.data ?? []).filter((record) => record.status === "pending");
    } catch (_error) {
      this.dom.purchasePendingCount.textContent = "—";
      this.dom.purchasePendingList.hidden = true;
      errorNotice.textContent = t(this.state.getCurrentLanguage(), "purchaseSummaryFailed");
      errorNotice.hidden = false;
      return;
    }
    this.dom.purchasePendingCount.textContent = String(pending.length);
    this.dom.purchasePendingList.replaceChildren(
      ...pending.slice(0, 5).map((record) => {
        const item = document.createElement("li");
        const price = record.listingSnapshot.price;
        if (record.summary.iconUrl) {
          const image = document.createElement("img");
          image.src = record.summary.iconUrl;
          image.alt = "";
          item.append(image);
        }
        const label = document.createElement("span");
        label.textContent = `${record.summary.displayName}${price ? ` · ${price.amount} ${price.currency}` : ""}`;
        item.append(label);
        return item;
      })
    );
    this.dom.purchasePendingList.hidden = pending.length === 0;
  }

  private setOptions(leagues: LeagueOption[]): void {
    this.dom.leagueSelect.innerHTML = "";
    leagues.forEach((league) => {
      const option = document.createElement("option");
      option.value = league.id;
      option.textContent = league.text;
      this.dom.leagueSelect.appendChild(option);
    });
  }

  private applyLanguage(language: string): void {
    const normalized = normalizeLanguage(language) as Language;
    this.state.setCurrentLanguage(normalized);
    document.documentElement.lang = normalized;
    applyTranslations(document, normalized);
    if (this.state.getRecords().length) this.renderSalesView();
  }

  private showModal(title: string, message: string): void {
    this.dom.modalTitle.textContent = title;
    this.dom.modalMessage.textContent = message;
    if (!this.dom.modal.open) {
      this.modalPreviousFocus =
        document.activeElement instanceof HTMLElement && document.activeElement !== document.body
          ? document.activeElement
          : this.dom.refreshButton;
      this.dom.modal.showModal();
    }
    this.dom.modalClose.focus();
  }

  private hideModal(): void {
    this.dom.modal.close();
  }

  private async refreshData(leagueId: string): Promise<void> {
    const records = await this.historyService.loadRecords(leagueId);
    this.state.setRecords(records);

    this.dom.chartSection.hidden = records.length === 0;
    this.renderSalesView();
  }

  private selectDate(date: string | null): void {
    this.selectedDate = date;
    this.state.setCurrentPage(1);
    this.renderSalesView();
  }

  private getVisibleRecords(): TradeRecord[] {
    return this.selectedDate
      ? this.state.getRecords().filter((record) => formatDateKey(record.time) === this.selectedDate)
      : this.state.getRecords();
  }

  private renderSalesView(): void {
    const records = this.state.getRecords();
    const language = this.state.getCurrentLanguage();
    this.chartService.render(records, this.selectedDate, language);
    this.tableRenderer.renderTable(this.getVisibleRecords());
    this.dom.showAllDatesButton.setAttribute("aria-pressed", String(this.selectedDate === null));
    this.dom.selectedDateLabel.textContent = t(
      language,
      this.selectedDate ? "salesSelectedDate" : "salesAllDatesSelected",
      this.selectedDate ? { date: this.selectedDate } : undefined
    );
  }

  private resolveErrorMessage(
    code: string | undefined,
    meta: HistoryErrorMeta | undefined
  ): string {
    const language = this.state.getCurrentLanguage();
    if (code === "LEAGUE_MISMATCH") {
      return t(language, "errorLeagueMismatch", {
        expected: meta?.expectedLeague ?? "",
        actual: meta?.actualLeague ?? "",
      });
    }
    if (code === "DUPLICATE_ID") {
      return t(language, "errorDuplicateId", { itemId: meta?.itemId ?? "" });
    }
    if (code === "AUTH_EXPIRED") {
      return t(language, "errorAuthExpired");
    }
    if (code === "RATE_LIMIT") {
      return t(language, "errorRateLimit", { seconds: meta?.remainingSec ?? "" });
    }
    if (code === "FETCH_FAILED") {
      return t(language, "errorFetchFailed");
    }
    return t(language, "errorUnknown");
  }

  private async handleUpdate(): Promise<void> {
    this.dom.refreshButton.disabled = true;
    this.dom.refreshButton.setAttribute("aria-busy", "true");
    const status = document.getElementById("sales-status")!;
    status.textContent = t(this.state.getCurrentLanguage(), "salesUpdating");
    const leagueId = this.dom.leagueSelect.value;
    try {
      const response = await this.historyService.requestUpdate(leagueId, "user");
      if (!response?.ok) {
        this.showModal(
          t(this.state.getCurrentLanguage(), "modalErrorTitle"),
          this.resolveErrorMessage(response.error?.code, response.error?.meta)
        );
        return;
      }
      await this.refreshData(leagueId);
      const added = response.result?.addedCount ?? 0;
      const fetched = response.result?.fetchedCount ?? 0;
      const total = response.result?.totalCount ?? fetched;
      status.textContent = t(this.state.getCurrentLanguage(), "updateResult", { total, added });
    } catch (_error) {
      this.showModal(
        t(this.state.getCurrentLanguage(), "modalErrorTitle"),
        t(this.state.getCurrentLanguage(), "modalUpdateFailed")
      );
    } finally {
      this.dom.refreshButton.disabled = false;
      this.dom.refreshButton.removeAttribute("aria-busy");
      if (this.dom.modal.open) status.textContent = "";
    }
  }

  private handleCsvExport(): void {
    if (!this.dom.leagueSelect.value) {
      this.showModal(
        t(this.state.getCurrentLanguage(), "modalErrorTitle"),
        t(this.state.getCurrentLanguage(), "modalSelectLeague")
      );
      return;
    }
    const records = this.getVisibleRecords();
    if (!records.length) {
      this.showModal(
        t(this.state.getCurrentLanguage(), "modalErrorTitle"),
        t(this.state.getCurrentLanguage(), "modalNoExportData")
      );
      return;
    }

    const csvText = buildCsv(records, this.state.getCurrentLanguage());
    const filename = buildCsvFilename(this.dom.leagueSelect.value);
    downloadCsv(csvText, filename);
  }
}
