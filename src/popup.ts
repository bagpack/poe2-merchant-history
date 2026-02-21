// @ts-nocheck
// Why: popup.ts is migrated to TypeScript module layout first to unblock build pipeline;
// full strict typing will be added incrementally because this file has broad UI/data concerns.
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
const detailSubtitle = document.getElementById("detail-subtitle");
const detailBody = document.getElementById("detail-body");
const detailCard = document.getElementById("detail-card");

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
  const detail = record.details_json || {};
  const name = detail.name?.trim() || "";
  const typeLine = detail.typeLine?.trim() || record.item_name || "";
  const title = name || typeLine || "-";
  const subtitle = name && typeLine ? typeLine : detail.baseType?.trim() || "";

  detailTitle.textContent = title;
  detailSubtitle.textContent = subtitle;
  detailSubtitle.hidden = !subtitle;
  detailBody.innerHTML = "";
  detailCard.dataset.rarity = normalizeRarity(detail.rarity);

  const visualSection = renderItemVisual(detail);
  if (visualSection) {
    detailBody.appendChild(visualSection);
  }

  appendSection(buildPropertySectionLines(detail), "muted");
  appendSection(buildGemSocketsLines(detail), "muted");
  appendSection(buildRequirementsLines(detail.requirements), "muted");
  appendSection(buildEnchantSectionLines(detail), "enchanted");
  appendSection(toDisplayLines(detail.implicitMods), "magic");
  appendSection(buildRuneSectionLines(detail), "enchanted");
  appendSection(toDisplayLines(detail.fracturedMods), "fractured");
  appendSection(toDisplayLines(detail.explicitMods), "magic");
  appendSection(buildDesecratedSectionLines(detail), "desecrated");
  appendSection(toLogbookLines(detail.logbookMods), "muted");

  const corruptionStatus = getCorruptionLabel(detail);
  if (corruptionStatus) {
    appendSection([corruptionStatus], "corrupted");
  }
  if (!detailBody.children.length) {
    appendSection([t(currentLanguage, "detailNone")], "muted");
  }

  detailModal.classList.remove("hidden");
}

function hideDetail() {
  detailModal.classList.add("hidden");
}

function getCorruptionLabel(detail) {
  const isDouble =
    detail?.doubleCorrupted ||
    detail?.double_corrupted ||
    detail?.isDoubleCorrupted ||
    detail?.is_double_corrupted;
  if (isDouble) {
    return t(currentLanguage, "detailDoubleCorrupted");
  }

  const isCorrupted = detail?.corrupted || detail?.isCorrupted || detail?.is_corrupted;
  if (isCorrupted) {
    return t(currentLanguage, "detailCorrupted");
  }

  return null;
}

function normalizeRarity(rarity) {
  const normalized = String(rarity || "normal")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  return normalized || "normal";
}

function appendSection(lines, tone) {
  const filtered = (lines || []).filter(
    (line) => line !== null && line !== undefined && line !== ""
  );
  if (!filtered.length) {
    return;
  }
  const section = document.createElement("section");
  section.className = `detail-section detail-section-${tone}`;
  filtered.forEach((line) => {
    const p = document.createElement("p");
    p.className = `item-line item-line-${resolveLineTone(line, tone)}`;
    if (isMetaLine(line)) {
      const label = document.createElement("span");
      label.className = "item-line-label";
      label.textContent = line.label;
      p.appendChild(label);

      if (line.value !== null && line.value !== undefined && line.value !== "") {
        p.appendChild(document.createTextNode(" "));
        if (line.kind === "requires") {
          appendRequiresValue(p, String(line.value));
        } else {
          const value = document.createElement("span");
          value.className = "item-line-value";
          value.textContent = String(line.value);
          p.appendChild(value);
        }
      }
    } else {
      p.textContent = line;
    }
    section.appendChild(p);
  });
  detailBody.appendChild(section);
}

function buildPropertySectionLines(detail) {
  const lines = reorderPropertyLines(toDisplayLines(detail.properties));
  const itemLevel = Number(detail.ilvl);
  const hasItemLevel =
    detail.ilvl !== null &&
    detail.ilvl !== undefined &&
    detail.ilvl !== "" &&
    !Number.isNaN(itemLevel) &&
    itemLevel > 0;
  if (hasItemLevel) {
    lines.push({
      label: `${t(currentLanguage, "detailIlvl")}:`,
      value: itemLevel,
      kind: "item-level",
    });
  }
  return lines;
}

function reorderPropertyLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return [];
  }
  const mapped = lines.map((line) => normalizeCorruptionLevelLine(line)).filter(Boolean);
  const corruptionIndex = mapped.findIndex((line) => isCorruptionLevelLine(line));
  if (corruptionIndex === -1) {
    return mapped;
  }
  const qualityIndex = mapped.findIndex((line) => isQualityLine(line));
  if (qualityIndex <= 0 || qualityIndex === corruptionIndex) {
    return mapped;
  }

  const reordered = [...mapped];
  const [corruptionLine] = reordered.splice(corruptionIndex, 1);
  const insertIndex = corruptionIndex < qualityIndex ? qualityIndex - 1 : qualityIndex;
  reordered.splice(insertIndex, 0, corruptionLine);
  return reordered;
}

function normalizeCorruptionLevelLine(line) {
  if (typeof line !== "string") {
    return line;
  }
  const match = line.match(/([+-]\d+)\s*Level from Corruption/i);
  if (!match) {
    return line;
  }
  const delta = match[1];
  if (currentLanguage === "ja") {
    return `穢れにより${delta}レベル`;
  }
  return `${delta} Level from Corruption`;
}

function isCorruptionLevelLine(line) {
  if (typeof line !== "string") {
    return false;
  }
  return (
    /Level from Corruption/i.test(line) ||
    line.includes("穢れにより+1レベル") ||
    line.includes("穢れにより-1レベル") ||
    line.includes("穢れにより+-1レベル")
  );
}

function isQualityLine(line) {
  if (typeof line !== "string") {
    return false;
  }
  return /quality/i.test(line) || line.includes("品質");
}

function buildDesecratedSectionLines(detail) {
  const lines = toDisplayLines(detail.desecratedMods);
  const isDesecrated = detail?.desecrated || detail?.isDesecrated || detail?.is_desecrated;
  if (isDesecrated && !lines.length) {
    lines.push(t(currentLanguage, "detailDesecratedMods"));
  }
  return lines;
}

function isActiveSkillGem(detail) {
  return detail?.frameType === 4 && detail?.support === false;
}

function buildGemSocketsLines(detail) {
  if (!isActiveSkillGem(detail) || !Array.isArray(detail?.gemSockets)) {
    return [];
  }
  const socketCount = detail.gemSockets.length;
  if (socketCount <= 0) {
    return [];
  }
  return [
    {
      label: `${t(currentLanguage, "detailGemSockets")}:`,
      value: socketCount,
      kind: "gem-sockets-count",
    },
  ];
}

function buildEnchantSectionLines(detail) {
  return toDisplayLines(detail?.enchantMods);
}

function buildRequirementsLines(requirements) {
  if (!Array.isArray(requirements) || requirements.length === 0) {
    return [];
  }
  if (requirements.every((entry) => typeof entry === "string")) {
    const joined = requirements.filter(Boolean).join(", ").trim();
    if (!joined) {
      return [];
    }
    if (joined.toLowerCase().startsWith("requires:")) {
      return [joined];
    }
    return [{ label: "Requires:", value: joined, kind: "requires" }];
  }

  const parts = requirements.map((entry) => formatRequirementPart(entry)).filter(Boolean);
  if (!parts.length) {
    return [];
  }
  return [{ label: "Requires:", value: parts.join(", "), kind: "requires" }];
}

function buildRuneSectionLines(detail) {
  const lines = [...toDisplayLines(detail.runeMods)];
  const fallbackLines = extractSocketedRuneEffects(detail);
  fallbackLines.forEach((line) => {
    if (!lines.includes(line)) {
      lines.push(line);
    }
  });
  return lines;
}

function formatRequirementPart(requirement) {
  if (!requirement || typeof requirement !== "object") {
    return null;
  }
  const name = normalizeRequirementToken(requirement.name);
  const value = (requirement.values || [])
    .map((v) => (Array.isArray(v) ? v[0] : String(v)))
    .find(Boolean);
  if (!name && !value) {
    return null;
  }
  if (!name) {
    return String(value);
  }
  if (!value) {
    return name;
  }
  if (name.toLowerCase() === "level") {
    return `${name} ${value}`;
  }
  return `${value} ${name}`;
}

function normalizeRequirementToken(text) {
  const source = String(text || "").trim();
  if (!source) {
    return "";
  }
  return source
    .replace(/\[([^|\]]+)\|([^\]]+)\]/g, "$2")
    .replace(/\[([^\]]+)\]/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function appendRequiresValue(parent, valueText) {
  const parts = valueText
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) {
    const fallback = document.createElement("span");
    fallback.className = "item-line-value";
    fallback.textContent = valueText;
    parent.appendChild(fallback);
    return;
  }
  parts.forEach((part, index) => {
    if (index > 0) {
      const separator = document.createElement("span");
      separator.className = "item-line-separator";
      separator.textContent = ", ";
      parent.appendChild(separator);
    }
    const token = document.createElement("span");
    token.className = "item-line-value";
    token.textContent = part;
    parent.appendChild(token);
  });
}

function isMetaLine(line) {
  return typeof line === "object" && line !== null && "label" in line;
}

function resolveLineTone(line, fallbackTone) {
  if (!line) {
    return fallbackTone;
  }
  if (typeof line === "object" && line.kind === "item-level") {
    return "muted";
  }
  const text = typeof line === "string" ? line : "";
  if (text.includes("Desecrated") || text.includes("冒涜")) {
    return "desecrated";
  }
  if (text.includes("Fractured") || text.includes("フラクト")) {
    return "fractured";
  }
  if (text.includes("Corrupted") || text.includes("コラプト")) {
    return "corrupted";
  }
  const trimmed = text.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || trimmed.startsWith("-")) {
    return "flavor";
  }
  return fallbackTone;
}

function toDisplayLines(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map((item) => {
      if (!item) {
        return null;
      }
      if (typeof item === "string") {
        return item;
      }
      const name = item.name ? String(item.name).trim() : "";
      const values = (item.values || [])
        .map((value) => (Array.isArray(value) ? value[0] : String(value)))
        .filter(Boolean)
        .join(", ");
      if (name && values) {
        return `${name}: ${values}`;
      }
      if (name) {
        return name;
      }
      return values || null;
    })
    .filter(Boolean);
}

function toLogbookLines(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  const lines = [];
  items.forEach((item) => {
    if (!item || !item.name) {
      return;
    }
    lines.push(item.name);
    if (Array.isArray(item.mods)) {
      item.mods.forEach((mod) => {
        if (mod) {
          lines.push(`- ${mod}`);
        }
      });
    }
  });
  return lines;
}

function extractSocketedRuneEffects(detail) {
  if (!Array.isArray(detail?.socketedItems)) {
    return [];
  }
  const lines = [];
  detail.socketedItems.forEach((socketedItem) => {
    if (!socketedItem || typeof socketedItem !== "object") {
      return;
    }
    const baseName = `${socketedItem.name || ""} ${socketedItem.typeLine || ""}`.toLowerCase();
    const looksLikeRune = baseName.includes("rune") || baseName.includes("soul core");
    if (!looksLikeRune) {
      return;
    }

    toDisplayLines(socketedItem.runeMods).forEach((line) => {
      if (!lines.includes(line)) {
        lines.push(line);
      }
    });

    (socketedItem.properties || []).forEach((property) => {
      const line = toPropertyStatLine(property);
      if (!line || !isLikelyRuneEffect(line)) {
        return;
      }
      if (!lines.includes(line)) {
        lines.push(line);
      }
    });
  });
  return lines;
}

function toPropertyStatLine(property) {
  if (!property || typeof property !== "object") {
    return null;
  }
  const name = String(property.name || "").trim();
  const values = (property.values || [])
    .map((value) => (Array.isArray(value) ? value[0] : String(value)))
    .filter(Boolean)
    .join(", ");
  if (!name && !values) {
    return null;
  }
  if (name && values) {
    return `${name}: ${values}`;
  }
  return name || values;
}

function isLikelyRuneEffect(line) {
  if (!line || typeof line !== "string") {
    return false;
  }
  const text = line.trim().toLowerCase();
  if (!text.includes(":")) {
    return false;
  }
  if (
    text.includes("stack size") ||
    text.includes("requires") ||
    text.includes("limited to") ||
    text.startsWith("rune:") ||
    text.startsWith("soul core:")
  ) {
    return false;
  }
  return true;
}

function renderItemVisual(detail) {
  const hasIcon = Boolean(detail?.icon);
  const sockets = normalizeSockets(detail?.sockets);
  if (!hasIcon && !sockets.length) {
    return null;
  }

  const section = document.createElement("section");
  section.className = "detail-section detail-section-visual";

  if (hasIcon) {
    const visual = document.createElement("div");
    visual.className = "item-visual";

    const icon = document.createElement("img");
    icon.className = "item-icon";
    icon.src = detail.icon;
    icon.alt = detail.typeLine || "item";
    visual.appendChild(icon);

    if (sockets.length) {
      const overlay = document.createElement("div");
      overlay.className = "socket-overlay";
      const points = computeSocketPoints(sockets.length, detail?.w, detail?.h);
      sockets.forEach((socket, index) => {
        const node = document.createElement("span");
        node.className = `socket-node socket-${socket.kind}`;
        node.style.setProperty("--socket-x", `${points[index].x}%`);
        node.style.setProperty("--socket-y", `${points[index].y}%`);
        node.title = `${t(currentLanguage, "detailSockets")} #${index + 1}`;
        overlay.appendChild(node);
      });
      visual.appendChild(overlay);
    }

    section.appendChild(visual);
  } else if (sockets.length) {
    const socketRow = document.createElement("div");
    socketRow.className = "socket-row";
    sockets.forEach((socket, index) => {
      const node = document.createElement("span");
      node.className = `socket-node socket-${socket.kind}`;
      node.title = `${t(currentLanguage, "detailSockets")} #${index + 1}`;
      socketRow.appendChild(node);
      if (index < sockets.length - 1) {
        const spacer = document.createElement("span");
        spacer.className = "socket-link";
        spacer.textContent = " ";
        socketRow.appendChild(spacer);
      }
    });
    section.appendChild(socketRow);
  }

  return section;
}

function normalizeSockets(sockets) {
  if (!Array.isArray(sockets)) {
    return [];
  }
  return sockets.map((socket) => {
    if (!socket || typeof socket !== "object") {
      return { group: -1, kind: "default" };
    }
    const type = String(socket.type || socket.kind || "").toLowerCase();
    if (type.includes("rune")) {
      return { group: socket.group ?? -1, kind: "rune" };
    }
    if (type.includes("support")) {
      return { group: socket.group ?? -1, kind: "support" };
    }
    if (type.includes("gem")) {
      return { group: socket.group ?? -1, kind: "gem" };
    }
    return { group: socket.group ?? -1, kind: "default" };
  });
}

function computeSocketPoints(count, itemWidth, itemHeight) {
  const width = Number(itemWidth) || 2;
  const height = Number(itemHeight) || 2;
  const vertical = height > width;
  const templatesVertical = [
    { x: 50, y: 14 },
    { x: 50, y: 86 },
    { x: 26, y: 50 },
    { x: 74, y: 50 },
    { x: 26, y: 80 },
    { x: 74, y: 20 },
  ];
  const templatesHorizontal = [
    { x: 14, y: 50 },
    { x: 86, y: 50 },
    { x: 50, y: 26 },
    { x: 50, y: 74 },
    { x: 20, y: 26 },
    { x: 80, y: 74 },
  ];
  const table = vertical ? templatesVertical : templatesHorizontal;
  return Array.from({ length: count }, (_, idx) => table[idx] || { x: 50, y: 50 });
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
