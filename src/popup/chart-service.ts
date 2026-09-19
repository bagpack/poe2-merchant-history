import { t } from "../i18n.js";
import { buildCurrencyOrder, formatAmount, formatDateKey, getCurrencyIcon } from "./formatters.js";
import type { Language, TradeRecord } from "./types.js";

export interface DailySales {
  date: string;
  saleCount: number;
  totals: Map<string, number>;
}

export function buildDailySales(records: TradeRecord[]): DailySales[] {
  const daily = new Map<string, DailySales>();
  for (const record of records) {
    const date = formatDateKey(record.time);
    const summary = daily.get(date) ?? {
      date,
      saleCount: 0,
      totals: new Map<string, number>(),
    };
    summary.saleCount += 1;
    if (record.currency) {
      summary.totals.set(
        record.currency,
        (summary.totals.get(record.currency) ?? 0) + Number(record.amount ?? 0)
      );
    }
    daily.set(date, summary);
  }
  return [...daily.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export class ChartService {
  constructor(
    private readonly rail: HTMLElement,
    private readonly dataBody: HTMLTableSectionElement,
    private readonly daySummary: HTMLElement
  ) {}

  render(records: TradeRecord[], selectedDate: string | null, language: Language): void {
    const daily = buildDailySales(records);
    this.rail.replaceChildren(
      ...daily.map((day) => this.createFrame(day, day.date === selectedDate, language))
    );
    this.renderDataTable(daily);
    this.renderSummary(records, daily, selectedDate, language);
  }

  private createFrame(day: DailySales, selected: boolean, language: Language): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "film-frame";
    button.dataset.date = day.date;
    button.setAttribute("aria-pressed", String(selected));
    const currencyText = [...day.totals].map(([name, amount]) => `${amount} ${name}`).join(", ");
    button.setAttribute(
      "aria-label",
      `${day.date}, ${t(language, "salesCount", { count: day.saleCount })}${currencyText ? `, ${currencyText}` : ""}`
    );

    const date = document.createElement("span");
    date.className = "film-date";
    date.textContent = day.date;
    const count = document.createElement("span");
    count.className = "film-sale-count";
    count.textContent = t(language, "salesCount", { count: day.saleCount });
    button.append(date, count);
    return button;
  }

  private renderDataTable(daily: DailySales[]): void {
    this.dataBody.replaceChildren(
      ...daily.flatMap((day) =>
        [...day.totals].map(([currency, amount]) => {
          const row = document.createElement("tr");
          for (const value of [day.date, currency, String(amount)]) {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.append(cell);
          }
          return row;
        })
      )
    );
  }

  private renderSummary(
    records: TradeRecord[],
    daily: DailySales[],
    selectedDate: string | null,
    language: Language
  ): void {
    const visibleRecords = selectedDate
      ? records.filter((record) => formatDateKey(record.time) === selectedDate)
      : records;
    const totals = new Map<string, number>();
    for (const record of visibleRecords) {
      if (record.currency) {
        totals.set(
          record.currency,
          (totals.get(record.currency) ?? 0) + Number(record.amount ?? 0)
        );
      }
    }

    const heading = document.createElement("h2");
    heading.textContent = t(language, selectedDate ? "salesDaySummary" : "salesPeriodSummary");
    const list = document.createElement("dl");
    const countGroup = document.createElement("div");
    countGroup.className = "summary-count";
    const countTerm = document.createElement("dt");
    countTerm.textContent = t(language, "salesTransactions");
    const countValue = document.createElement("dd");
    countValue.textContent = String(visibleRecords.length);
    countGroup.append(countTerm, countValue);
    list.append(
      countGroup,
      ...buildCurrencyOrder(visibleRecords).flatMap((currency) => {
        const amount = totals.get(currency);
        if (amount === undefined) return [];
        const group = document.createElement("div");
        group.className = "summary-currency";
        const iconUrl = getCurrencyIcon(currency);
        if (iconUrl) {
          const icon = document.createElement("img");
          icon.src = iconUrl;
          icon.alt = "";
          group.append(icon);
        }
        const term = document.createElement("dt");
        term.textContent = currency;
        const value = document.createElement("dd");
        value.textContent = formatAmount(amount, language);
        group.append(term, value);
        return [group];
      })
    );
    const note = document.createElement("p");
    note.className = "day-summary-note";
    note.textContent = t(language, "salesCurrencyNote");
    this.daySummary.replaceChildren(heading, list, note);
    this.daySummary.hidden = daily.length === 0;
  }
}
