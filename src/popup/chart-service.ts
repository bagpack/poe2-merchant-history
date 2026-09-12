import { buildCurrencyOrder, formatDateKey } from "./formatters.js";
import type { ChartCtor, ChartDataset, ChartLike, TradeRecord } from "./types.js";

const currencies = [
  "divine",
  "exalted",
  "chaos",
  "annul",
  "regal",
  "alchemy",
  "chance",
  "scour",
  "transmute",
  "alteration",
  "augmentation",
  "wisdom",
];

declare global {
  interface Window {
    Chart?: ChartCtor;
  }
}

export class ChartService {
  constructor(private readonly canvas: HTMLCanvasElement) {}

  render(records: TradeRecord[], chartInstance: ChartLike | null): ChartLike | null {
    const chartConstructor = window.Chart;
    if (!chartConstructor) {
      return chartInstance;
    }

    const daily = new Map<string, Map<string, number>>();
    records.forEach((record) => {
      const dateKey = formatDateKey(record.time);
      if (!daily.has(dateKey)) {
        daily.set(dateKey, new Map<string, number>());
      }
      const map = daily.get(dateKey);
      if (!map) {
        return;
      }
      const currency = record.currency || "";
      const current = map.get(currency) || 0;
      map.set(currency, current + Number(record.amount || 0));
    });

    const labels = Array.from(daily.keys()).sort();
    const orderedCurrencies = buildCurrencyOrder(records);

    const theme = getComputedStyle(this.canvas);
    const textColor = theme.getPropertyValue("--muted").trim();
    const gridColor = theme.getPropertyValue("--chart-grid").trim();
    let fallbackIndex = 0;
    const datasets = orderedCurrencies
      .map((currency) => {
        const data = labels.map((label) => daily.get(label)?.get(currency) || 0);
        if (data.every((value) => value === 0)) {
          return null;
        }
        const knownIndex = currencies.indexOf(currency);
        const colorIndex = knownIndex >= 0 ? knownIndex : fallbackIndex++ % currencies.length;
        const color = theme.getPropertyValue(`--chart-${colorIndex}`).trim();
        const dataset: ChartDataset = {
          label: currency,
          data,
          borderColor: color,
          backgroundColor: "rgba(0,0,0,0)",
          tension: 0.2,
        };
        return dataset;
      })
      .filter((dataset): dataset is ChartDataset => dataset !== null);

    if (chartInstance) {
      chartInstance.data.labels = labels;
      chartInstance.data.datasets = datasets;
      chartInstance.update();
      return chartInstance;
    }

    return new chartConstructor(this.canvas, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: textColor },
          },
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: {
              maxTicksLimit: 6,
              color: textColor,
            },
          },
          y: {
            beginAtZero: true,
            ticks: { color: textColor },
            grid: { color: gridColor },
          },
        },
      },
    });
  }
}
