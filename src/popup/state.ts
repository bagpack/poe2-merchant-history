import type { Language, TradeRecord } from "./types.js";

export class PopupState {
  private allRecords: TradeRecord[] = [];
  private currentPage = 1;
  private currentLanguage: Language = "en";

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
