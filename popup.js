import { openLeagueDb, requestToPromise } from "./shared.js";

const leagueSelect = document.getElementById("league-select");
const refreshButton = document.getElementById("refresh-btn");
const totalsContainer = document.getElementById("totals");
const historyBody = document.getElementById("history-body");
const searchInput = document.getElementById("search-input");
const pageSizeSelect = document.getElementById("page-size");
const prevPageButton = document.getElementById("prev-page");
const nextPageButton = document.getElementById("next-page");
const pageInfo = document.getElementById("page-info");
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modal-title");
const modalMessage = document.getElementById("modal-message");
const modalClose = document.getElementById("modal-close");
const detailModal = document.getElementById("detail-modal");
const detailTitle = document.getElementById("detail-title");
const detailBody = document.getElementById("detail-body");
const detailClose = document.getElementById("detail-close");

const currencyOrder = [
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

const currencyColorMap = new Map([
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

let chartInstance = null;
let allRecords = [];
let currentPage = 1;

const errorMessages = {
  LEAGUE_MISMATCH: (meta) =>
    `リーグが一致しません。期待: ${meta?.expectedLeague ?? ""} / 実際: ${meta?.actualLeague ?? ""}`,
  DUPLICATE_ID: (meta) =>
    `重複IDが検出されました。ID: ${meta?.itemId ?? ""}（処理を停止しました）`,
  FETCH_FAILED: () => "履歴の取得に失敗しました。時間をおいて再試行してください。",
  AUTH_EXPIRED: () => "ログイン情報の有効期限が切れています。再ログインしてください。",
  RATE_LIMIT: (meta) =>
    `更新は1分に1回までです。あと${meta?.remainingSec ?? ""}秒お待ちください。`,
  UNKNOWN: () => "予期しないエラーが発生しました。",
};

function showModal(title, message) {
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modal.classList.remove("hidden");
}

function hideModal() {
  modal.classList.add("hidden");
}

function showDetail(record) {
  detailTitle.textContent = formatItemName(record);
  detailBody.innerHTML = "";

  const detail = record.details_json || {};
  detailBody.appendChild(renderDetailBlock("基本情報", [
    renderDetailRow("icon", detail.icon),
    renderDetailText(`typeLine: ${detail.typeLine || ""}`),
    renderDetailText(`baseType: ${detail.baseType || ""}`),
    renderDetailText(`rarity: ${detail.rarity || ""}`),
    renderDetailText(`ilvl: ${detail.ilvl ?? ""}`),
  ]));

  detailBody.appendChild(renderListBlock("properties", detail.properties));
  detailBody.appendChild(renderListBlock("requirements", detail.requirements));
  detailBody.appendChild(renderListBlock("explicitMods", detail.explicitMods));

  detailModal.classList.remove("hidden");
}

function hideDetail() {
  detailModal.classList.add("hidden");
}

function renderDetailBlock(title, nodes) {
  const block = document.createElement("div");
  block.className = "detail-block";
  const heading = document.createElement("h4");
  heading.textContent = title;
  block.appendChild(heading);
  nodes.forEach((node) => {
    if (node) {
      block.appendChild(node);
    }
  });
  return block;
}

function renderDetailRow(label, iconUrl) {
  if (!iconUrl) {
    return null;
  }
  const row = document.createElement("div");
  row.className = "detail-row";
  const img = document.createElement("img");
  img.alt = label;
  img.src = iconUrl;
  row.appendChild(img);
  return row;
}

function renderDetailText(text) {
  const p = document.createElement("p");
  p.textContent = text;
  return p;
}

function renderListBlock(title, items) {
  const block = document.createElement("div");
  block.className = "detail-block";
  const heading = document.createElement("h4");
  heading.textContent = title;
  block.appendChild(heading);

  if (!items || items.length === 0) {
    block.appendChild(renderDetailText("なし"));
    return block;
  }

  items.forEach((item) => {
    if (typeof item === "string") {
      block.appendChild(renderDetailText(item));
      return;
    }
    if (!item || !item.name) {
      return;
    }
    const values = (item.values || [])
      .map((value) => (Array.isArray(value) ? value[0] : String(value)))
      .join(", ");
    block.appendChild(renderDetailText(values ? `${item.name}: ${values}` : item.name));
  });

  return block;
}

async function loadLeagues() {
  const response = await fetch("https://jp.pathofexile.com/trade2/history", {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("リーグ一覧の取得に失敗しました。");
  }
  const html = await response.text();
  const config = extractTradeConfig(html);
  return config.leagues || [];
}

function extractTradeConfig(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const scripts = Array.from(doc.querySelectorAll("script"));
  const target = scripts
    .map((script) => script.textContent || "")
    .find((text) => text.includes("require([\"trade\"]") && text.includes("leagues"));

  if (!target) {
    throw new Error("リーグ設定が見つかりません。");
  }

  const configText = extractObjectLiteral(target, "t(");
  return JSON.parse(configText);
}

function extractObjectLiteral(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error("設定JSONの開始位置が見つかりません。");
  }
  let index = source.indexOf("{", markerIndex);
  if (index === -1) {
    throw new Error("設定JSONが見つかりません。");
  }

  let depth = 0;
  let endIndex = -1;
  for (; index < source.length; index++) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        endIndex = index + 1;
        break;
      }
    }
  }

  if (endIndex === -1) {
    throw new Error("設定JSONの終端が見つかりません。");
  }

  return source.slice(source.indexOf("{", markerIndex), endIndex);
}

function setOptions(select, leagues) {
  select.innerHTML = "";
  leagues.forEach((league) => {
    const option = document.createElement("option");
    option.value = league.id;
    option.textContent = league.text;
    select.appendChild(option);
  });
}

function storeSelectedLeague(leagueId) {
  chrome.storage.local.set({ leagueId });
}

function loadSelectedLeague() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["leagueId"], (data) => resolve(data.leagueId || null));
  });
}

function formatDateTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString("ja-JP");
}

function formatDateKey(isoString) {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildCurrencyOrder(records) {
  const seen = new Set(currencyOrder);
  const extra = [];
  records.forEach((record) => {
    if (record.currency && !seen.has(record.currency)) {
      seen.add(record.currency);
      extra.push(record.currency);
    }
  });
  return [...currencyOrder, ...extra];
}

function renderTotals(records) {
  totalsContainer.innerHTML = "";
  if (records.length === 0) {
    totalsContainer.textContent = "データがありません。";
    return;
  }

  const totals = new Map();
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
    totalsContainer.appendChild(pill);
  });
}

function renderChart(records) {
  const ctx = document.getElementById("sales-chart");
  if (!window.Chart) {
    return;
  }

  const daily = new Map();
  records.forEach((record) => {
    const dateKey = formatDateKey(record.time);
    if (!daily.has(dateKey)) {
      daily.set(dateKey, new Map());
    }
    const map = daily.get(dateKey);
    const current = map.get(record.currency) || 0;
    map.set(record.currency, current + Number(record.amount || 0));
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
        currencyColorMap.get(currency) ||
        fallbackColors[fallbackIndex++ % fallbackColors.length];
      return {
        label: currency,
        data,
        borderColor: color,
        backgroundColor: "rgba(0,0,0,0)",
        tension: 0.2,
      };
    })
    .filter(Boolean);

  if (chartInstance) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets = datasets;
    chartInstance.update();
    return;
  }

  chartInstance = new Chart(ctx, {
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

function applyFilters(records) {
  const query = searchInput.value.trim();
  let filtered = records;
  if (query) {
    filtered = records.filter((record) =>
      record.details_json?.typeLine?.toLowerCase().includes(query.toLowerCase())
    );
  }
  return filtered;
}

function renderTable(records) {
  historyBody.innerHTML = "";
  const pageSize = Number(pageSizeSelect.value);
  const filtered = applyFilters(records);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  currentPage = Math.min(currentPage, totalPages);

  const start = (currentPage - 1) * pageSize;
  const pageRecords = filtered.slice(start, start + pageSize);

  pageRecords.forEach((record) => {
    const row = document.createElement("tr");
    const displayName = formatItemName(record);
    row.innerHTML = `
      <td>${formatDateTime(record.time)}</td>
      <td>${displayName}</td>
      <td>${record.currency ?? ""}</td>
      <td>${record.amount ?? ""}</td>
    `;
    row.addEventListener("click", () => showDetail(record));
    historyBody.appendChild(row);
  });

  pageInfo.textContent = `${currentPage} / ${totalPages}`;
  prevPageButton.disabled = currentPage <= 1;
  nextPageButton.disabled = currentPage >= totalPages;
}

async function loadRecords(leagueId) {
  const db = await openLeagueDb(leagueId);
  const tx = db.transaction("trade_history", "readonly");
  const store = tx.objectStore("trade_history");
  const records = await requestToPromise(store.getAll());

  return records
    .map((record) => ({
      ...record,
      _timeMs: Date.parse(record.time),
    }))
    .sort((a, b) => b._timeMs - a._timeMs);
}

async function refreshData(leagueId) {
  allRecords = await loadRecords(leagueId);
  renderTotals(allRecords);
  renderChart(allRecords);
  renderTable(allRecords);
}

function formatItemName(record) {
  const name = record.details_json?.name?.trim() || "";
  const typeLine = record.details_json?.typeLine?.trim() || record.item_name || "";
  if (name && typeLine) {
    return `${name} ${typeLine}`;
  }
  return typeLine || name || "";
}

async function handleUpdate() {
  refreshButton.disabled = true;
  const leagueId = leagueSelect.value;
  try {
    const response = await chrome.runtime.sendMessage({
      type: "updateHistory",
      leagueId,
    });
    if (!response?.ok) {
      const code = response?.error?.code || "UNKNOWN";
      const messageBuilder = errorMessages[code] || errorMessages.UNKNOWN;
      showModal("エラー", messageBuilder(response?.error?.meta));
      return;
    }
    await refreshData(leagueId);
    const added = response.result.addedCount ?? 0;
    const fetched = response.result.fetchedCount ?? 0;
    showModal("更新完了", `取得 ${fetched} 件 / 追加 ${added} 件`);
  } catch (error) {
    showModal("エラー", "更新に失敗しました。");
  } finally {
    refreshButton.disabled = false;
  }
}

async function init() {
  modalClose.addEventListener("click", hideModal);
  detailClose.addEventListener("click", hideDetail);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      hideModal();
    }
  });
  detailModal.addEventListener("click", (event) => {
    if (event.target === detailModal) {
      hideDetail();
    }
  });

  try {
    const leagues = await loadLeagues();
    setOptions(leagueSelect, leagues);
    const stored = await loadSelectedLeague();
    if (stored && leagues.some((league) => league.id === stored)) {
      leagueSelect.value = stored;
    }
  } catch (error) {
    showModal("エラー", "リーグ一覧の取得に失敗しました。");
  }

  leagueSelect.addEventListener("change", async () => {
    storeSelectedLeague(leagueSelect.value);
    currentPage = 1;
    await refreshData(leagueSelect.value);
  });

  refreshButton.addEventListener("click", handleUpdate);

  searchInput.addEventListener("input", () => {
    currentPage = 1;
    renderTable(allRecords);
  });

  pageSizeSelect.addEventListener("change", () => {
    currentPage = 1;
    renderTable(allRecords);
  });

  prevPageButton.addEventListener("click", () => {
    currentPage -= 1;
    renderTable(allRecords);
  });

  nextPageButton.addEventListener("click", () => {
    currentPage += 1;
    renderTable(allRecords);
  });

  if (leagueSelect.value) {
    await refreshData(leagueSelect.value);
  }
}

init();
