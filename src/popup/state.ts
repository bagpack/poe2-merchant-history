import type { ChartLike, Language, TradeRecord } from "./types.js";

export class PopupState {
  private chartInstance: ChartLike | null = null;
  private allRecords: TradeRecord[] = [];
  private currentPage = 1;
  private currentLanguage: Language = "en";

  getChart(): ChartLike | null {
    return this.chartInstance;
  }

  setChart(chart: ChartLike | null): void {
    this.chartInstance = chart;
  }

  getRecords(): TradeRecord[] {
    return this.allRecords;
  }

  setRecords(records: TradeRecord[]): void {
    this.allRecords = records;
  }

  getCurrentPage(): number {
    return this.currentPage;
  }

  setCurrentPage(page: number): void {
    this.currentPage = page;
  }

  getCurrentLanguage(): Language {
    return this.currentLanguage;
  }

  setCurrentLanguage(language: Language): void {
    this.currentLanguage = language;
  }
}
