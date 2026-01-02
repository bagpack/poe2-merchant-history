import { migrateLegacyDbIfNeeded, openLeagueDb, requestToPromise, toLeagueKey } from "./shared.js";
import {
  applyTranslations,
  getHostForLanguage,
  getLocaleForLanguage,
  loadUiLanguage,
  normalizeLanguage,
  saveUiLanguage,
  t,
} from "./i18n.js";

const leagueSelect = document.getElementById("league-select");
const refreshButton = document.getElementById("refresh-btn");
const languageSelect = document.getElementById("language-select");
const totalsContainer = document.getElementById("totals");
const historyBody = document.getElementById("history-body");
const searchInput = document.getElementById("search-input");
const pageSizeSelect = document.getElementById("page-size");
const csvExportButton = document.getElementById("csv-export");
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
let currentLanguage = "en";

const errorMessages = {
  LEAGUE_MISMATCH: (meta) =>
    t(currentLanguage, "errorLeagueMismatch", {
      expected: meta?.expectedLeague ?? "",
      actual: meta?.actualLeague ?? "",
    }),
  DUPLICATE_ID: (meta) => t(currentLanguage, "errorDuplicateId", { itemId: meta?.itemId ?? "" }),
  FETCH_FAILED: () => t(currentLanguage, "errorFetchFailed"),
  AUTH_EXPIRED: () => t(currentLanguage, "errorAuthExpired"),
  RATE_LIMIT: (meta) => t(currentLanguage, "errorRateLimit", { seconds: meta?.remainingSec ?? "" }),
  UNKNOWN: () => t(currentLanguage, "errorUnknown"),
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
  detailBody.appendChild(
    renderDetailBlock(t(currentLanguage, "detailBasicInfo"), [
      renderDetailRow("icon", detail.icon),
      renderDetailText(`${t(currentLanguage, "detailTypeLine")}: ${detail.typeLine || ""}`),
      renderDetailText(`${t(currentLanguage, "detailRarity")}: ${detail.rarity || ""}`),
      renderDetailText(
        `${t(currentLanguage, "detailSockets")}: ${detail.sockets ? detail.sockets.length : 0}`
      ),
      renderDetailText(`${t(currentLanguage, "detailIlvl")}: ${detail.ilvl ?? ""}`),
    ])
  );

  detailBody.appendChild(
    renderListBlock(t(currentLanguage, "detailProperties"), detail.properties)
  );
  if (detail.logbookMods && detail.logbookMods.length > 0) {
    detailBody.appendChild(
      renderListBlock(t(currentLanguage, "detailLogbookMods"), detail.logbookMods)
    );
  }
  detailBody.appendChild(
    renderListBlock(t(currentLanguage, "detailRequirements"), detail.requirements)
  );
  detailBody.appendChild(renderListBlock(t(currentLanguage, "detailRuneMods"), detail.runeMods));
  detailBody.appendChild(
    renderListBlock(t(currentLanguage, "detailExplicitMods"), detail.explicitMods)
  );
  detailBody.appendChild(
    renderListBlock(t(currentLanguage, "detailDesecratedMods"), detail.desecratedMods)
  );

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
    block.appendChild(renderDetailText(t(currentLanguage, "detailNone")));
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
    if (title === t(currentLanguage, "detailLogbookMods")) {
      const group = document.createElement("div");
      group.className = "logbook-group";
      const nameLine = document.createElement("div");
      nameLine.className = "logbook-name";
      nameLine.textContent = item.name;
      group.appendChild(nameLine);
      if (Array.isArray(item.mods) && item.mods.length > 0) {
        item.mods.forEach((mod) => {
          if (!mod) {
            return;
          }
          const modLine = document.createElement("div");
          modLine.className = "logbook-mod";
          modLine.textContent = mod;
          group.appendChild(modLine);
        });
      }
      block.appendChild(group);
      return;
    }
    const values = (item.values || [])
      .map((value) => (Array.isArray(value) ? value[0] : String(value)))
      .join(", ");
    block.appendChild(renderDetailText(values ? `${item.name}: ${values}` : item.name));
  });

  return block;
}

async function loadLeagues(language) {
  const host = getHostForLanguage(language);
  const response = await fetch(`${host}/trade2/history`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(t(currentLanguage, "modalLeagueFetchFailed"));
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
    .find((text) => text.includes('require(["trade"]') && text.includes("leagues"));

  if (!target) {
    throw new Error(t(currentLanguage, "modalLeagueFetchFailed"));
  }

  const configText = extractObjectLiteral(target, "t(");
  return JSON.parse(configText);
}

function extractObjectLiteral(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(t(currentLanguage, "modalLeagueFetchFailed"));
  }
  let index = source.indexOf("{", markerIndex);
  if (index === -1) {
    throw new Error(t(currentLanguage, "modalLeagueFetchFailed"));
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
    throw new Error(t(currentLanguage, "modalLeagueFetchFailed"));
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

function storePageSize(pageSize) {
  chrome.storage.local.set({ pageSize });
}

function loadPageSize() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["pageSize"], (data) => resolve(data.pageSize || null));
  });
}

function loadSelectedLeague() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["leagueId"], (data) => resolve(data.leagueId || null));
  });
}

function formatDateTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString(getLocaleForLanguage(currentLanguage));
}

function formatDateKey(isoString) {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildCsv(records) {
  const header = [
    t(currentLanguage, "csvHeaderDate"),
    t(currentLanguage, "csvHeaderItem"),
    t(currentLanguage, "csvHeaderCurrency"),
    t(currentLanguage, "csvHeaderAmount"),
  ];
  const rows = records.map((record) => [
    formatDateTime(record.time),
    formatItemName(record),
    record.currency ?? "",
    record.amount ?? "",
  ]);
  const lines = [header, ...rows].map((row) =>
    row.map((value) => csvEscape(String(value ?? ""))).join(",")
  );
  return "\ufeff" + lines.join("\n");
}

function csvEscape(value) {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function buildCsvFilename(leagueId) {
  const key = toLeagueKey(leagueId);
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const dd = `${date.getDate()}`.padStart(2, "0");
  return `merchant-history_${key}_${yyyy}-${mm}-${dd}.csv`;
}

function downloadCsv(csvText, filename) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
    totalsContainer.textContent = t(currentLanguage, "totalsEmpty");
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
        currencyColorMap.get(currency) || fallbackColors[fallbackIndex++ % fallbackColors.length];
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
  const db = await openLeagueDb(leagueId, currentLanguage);
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
      language: currentLanguage,
    });
    if (!response?.ok) {
      const code = response?.error?.code || "UNKNOWN";
      const messageBuilder = errorMessages[code] || errorMessages.UNKNOWN;
      showModal(t(currentLanguage, "modalErrorTitle"), messageBuilder(response?.error?.meta));
      return;
    }
    await refreshData(leagueId);
    const added = response.result.addedCount ?? 0;
    const fetched = response.result.fetchedCount ?? 0;
    const total = response.result.totalCount ?? fetched;
    showModal(
      t(currentLanguage, "modalUpdatedTitle"),
      t(currentLanguage, "updateResult", { total, added })
    );
  } catch (error) {
    showModal(t(currentLanguage, "modalErrorTitle"), t(currentLanguage, "modalUpdateFailed"));
  } finally {
    refreshButton.disabled = false;
  }
}

function applyLanguage(language) {
  currentLanguage = normalizeLanguage(language);
  document.documentElement.lang = currentLanguage;
  applyTranslations(document, currentLanguage);
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
    const storedLanguage = await loadUiLanguage();
    languageSelect.value = storedLanguage;
    applyLanguage(storedLanguage);

    const leagues = await loadLeagues(currentLanguage);
    setOptions(leagueSelect, leagues);
    const stored = await loadSelectedLeague();
    if (stored && leagues.some((league) => league.id === stored)) {
      leagueSelect.value = stored;
    }
    const storedPageSize = await loadPageSize();
    if (storedPageSize) {
      pageSizeSelect.value = String(storedPageSize);
    }
  } catch (error) {
    showModal(t(currentLanguage, "modalErrorTitle"), t(currentLanguage, "modalLeagueFetchFailed"));
  }

  leagueSelect.addEventListener("change", async () => {
    storeSelectedLeague(leagueSelect.value);
    currentPage = 1;
    await migrateLegacyDbIfNeeded(leagueSelect.value);
    await refreshData(leagueSelect.value);
  });

  refreshButton.addEventListener("click", handleUpdate);

  languageSelect.addEventListener("change", async () => {
    const selected = languageSelect.value;
    await saveUiLanguage(selected);
    applyLanguage(selected);
    currentPage = 1;
    try {
      const leagues = await loadLeagues(currentLanguage);
      setOptions(leagueSelect, leagues);
      const stored = await loadSelectedLeague();
      if (stored && leagues.some((league) => league.id === stored)) {
        leagueSelect.value = stored;
      }
    } catch (error) {
      showModal(
        t(currentLanguage, "modalErrorTitle"),
        t(currentLanguage, "modalLeagueFetchFailed")
      );
    }
    if (leagueSelect.value) {
      await migrateLegacyDbIfNeeded(leagueSelect.value);
      await refreshData(leagueSelect.value);
    }
  });

  csvExportButton.addEventListener("click", () => {
    if (!leagueSelect.value) {
      showModal(t(currentLanguage, "modalErrorTitle"), t(currentLanguage, "modalSelectLeague"));
      return;
    }
    if (!allRecords.length) {
      showModal(t(currentLanguage, "modalErrorTitle"), t(currentLanguage, "modalNoExportData"));
      return;
    }
    const csvText = buildCsv(allRecords);
    const filename = buildCsvFilename(leagueSelect.value);
    downloadCsv(csvText, filename);
  });

  searchInput.addEventListener("input", () => {
    currentPage = 1;
    renderTable(allRecords);
  });

  pageSizeSelect.addEventListener("change", () => {
    storePageSize(pageSizeSelect.value);
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
    await migrateLegacyDbIfNeeded(leagueSelect.value);
    await refreshData(leagueSelect.value);
  }
}

init();
