import { buildCurrencyOrder, formatDateKey } from "./formatters.js";
import type { ChartCtor, ChartDataset, ChartLike, TradeRecord } from "./types.js";

const currencyColorMap = new Map<string, string>([
  ["divine", "#b64b2a"],
  ["exalted", "#c58f4f"],
  ["chaos", "#6e5d4a"],
  ["annul", "#2f4b7c"],
  ["regal", "#8a5c2e"],
  ["alchemy", "#4f7b6a"],
  ["chance", "#3d5a80"],
  ["scour", "#795548"],
  ["transmute", "#9c27b0"],
  ["alteration", "#607d8b"],
  ["augmentation", "#ff7043"],
  ["wisdom", "#7e8b3a"],
]);

const fallbackColors = ["#4a2c0f", "#b64b2a", "#6e5d4a", "#c58f4f"];

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

    let fallbackIndex = 0;
    const datasets = orderedCurrencies
      .map((currency) => {
        const data = labels.map((label) => daily.get(label)?.get(currency) || 0);
        if (data.every((value) => value === 0)) {
          return null;
        }
        const color =
          currencyColorMap.get(currency) || fallbackColors[fallbackIndex++ % fallbackColors.length];
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
          },
        },
        scales: {
          x: {
            ticks: {
              maxTicksLimit: 6,
            },
          },
          y: {
            beginAtZero: true,
          },
        },
      },
    });
  }
}
