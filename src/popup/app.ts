import {
  applyTranslations,
  loadUiLanguage,
  normalizeLanguage,
  saveUiLanguage,
  t,
} from "../i18n.js";
import { migrateLegacyDbIfNeeded } from "../shared.js";
import { ChartService } from "./chart-service.js";
import { DetailRenderer } from "./detail-renderer.js";
import { getPopupDom } from "./dom.js";
import { buildCsv, buildCsvFilename, buildCurrencyOrder, downloadCsv } from "./formatters.js";
import { HistoryService } from "./history-service.js";
import { PopupState } from "./state.js";
import { TableRenderer } from "./table-renderer.js";
import type { HistoryErrorMeta, Language, LeagueOption, TradeRecord } from "./types.js";

export class PopupApp {
  private readonly dom = getPopupDom();
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
  private readonly chartService = new ChartService(this.dom.chartCanvas);

  async init(): Promise<void> {
    this.bindEvents();

    try {
      const storedLanguage = await loadUiLanguage();
      this.dom.languageSelect.value = storedLanguage;
      this.applyLanguage(storedLanguage);

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
    this.dom.modalClose.addEventListener("click", () => this.hideModal());
    this.dom.modal.addEventListener("click", (event) => {
      if (event.target === this.dom.modal) {
        this.hideModal();
      }
    });
    this.dom.detailModal.addEventListener("click", (event) => {
      if (event.target === this.dom.detailModal) {
        this.detailRenderer.hideDetail();
      }
    });

    this.dom.leagueSelect.addEventListener("change", async () => {
      this.historyService.storeSelectedLeague(this.dom.leagueSelect.value);
      this.state.setCurrentPage(1);
      await migrateLegacyDbIfNeeded(this.dom.leagueSelect.value);
      await this.refreshData(this.dom.leagueSelect.value);
    });

    this.dom.refreshButton.addEventListener("click", async () => this.handleUpdate());

    this.dom.languageSelect.addEventListener("change", async () => {
      const selected = this.dom.languageSelect.value;
      await saveUiLanguage(selected);
      this.applyLanguage(selected);
      this.state.setCurrentPage(1);
      try {
        const leagues = await this.historyService.loadLeagues();
        this.setOptions(leagues);
        const stored = await this.historyService.loadSelectedLeague();
        if (stored && leagues.some((league) => league.id === stored)) {
          this.dom.leagueSelect.value = stored;
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
    });

    this.dom.csvExportButton.addEventListener("click", () => this.handleCsvExport());

    this.dom.searchInput.addEventListener("input", () => {
      this.state.setCurrentPage(1);
      this.tableRenderer.renderTable(this.state.getRecords());
    });

    this.dom.pageSizeSelect.addEventListener("change", () => {
      this.historyService.storePageSize(this.dom.pageSizeSelect.value);
      this.state.setCurrentPage(1);
      this.tableRenderer.renderTable(this.state.getRecords());
    });

    this.dom.prevPageButton.addEventListener("click", () => {
      this.state.setCurrentPage(this.state.getCurrentPage() - 1);
      this.tableRenderer.renderTable(this.state.getRecords());
    });

    this.dom.nextPageButton.addEventListener("click", () => {
      this.state.setCurrentPage(this.state.getCurrentPage() + 1);
      this.tableRenderer.renderTable(this.state.getRecords());
    });
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
  }

  private showModal(title: string, message: string): void {
    this.dom.modalTitle.textContent = title;
    this.dom.modalMessage.textContent = message;
    this.dom.modal.classList.remove("hidden");
  }

  private hideModal(): void {
    this.dom.modal.classList.add("hidden");
  }

  private renderTotals(records: TradeRecord[]): void {
    this.dom.totalsContainer.innerHTML = "";
    if (records.length === 0) {
      this.dom.totalsContainer.textContent = t(this.state.getCurrentLanguage(), "totalsEmpty");
      return;
    }

    const totals = new Map<string, number>();
    records.forEach((record) => {
      if (!record.currency) {
        return;
      }
      const current = totals.get(record.currency) || 0;
      totals.set(record.currency, current + Number(record.amount || 0));
    });

    const ordered = buildCurrencyOrder(records);
    ordered.forEach((currency) => {
      if (!totals.has(currency)) {
        return;
      }
      const pill = document.createElement("div");
      pill.className = "total-pill";
      pill.textContent = `${currency}: ${totals.get(currency)}`;
      this.dom.totalsContainer.appendChild(pill);
    });
  }

  private async refreshData(leagueId: string): Promise<void> {
    const records = await this.historyService.loadRecords(leagueId);
    this.state.setRecords(records);
    this.renderTotals(records);

    const nextChart = this.chartService.render(records, this.state.getChart());
    this.state.setChart(nextChart);
    this.tableRenderer.renderTable(records);
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
    const leagueId = this.dom.leagueSelect.value;
    try {
      const response = await this.historyService.requestUpdate(leagueId);
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
      this.showModal(
        t(this.state.getCurrentLanguage(), "modalUpdatedTitle"),
        t(this.state.getCurrentLanguage(), "updateResult", { total, added })
      );
    } catch (_error) {
      this.showModal(
        t(this.state.getCurrentLanguage(), "modalErrorTitle"),
        t(this.state.getCurrentLanguage(), "modalUpdateFailed")
      );
    } finally {
      this.dom.refreshButton.disabled = false;
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
    const records = this.state.getRecords();
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
