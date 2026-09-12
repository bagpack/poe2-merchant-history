import { t } from "../i18n.js";
import type {
  DisplayLine,
  ItemDetailDom,
  ItemDetails,
  Language,
  MetaLine,
  StyledTextLine,
  TradeRecord,
} from "./types.js";

interface SocketPoint {
  x: number;
  y: number;
}

interface NormalizedSocket {
  group: number;
  kind: "default" | "rune" | "support" | "gem";
}

function isMetaLine(line: DisplayLine): line is MetaLine {
  return typeof line === "object" && line !== null && "label" in line;
}

function isStyledTextLine(line: DisplayLine): line is StyledTextLine {
  return typeof line === "object" && line !== null && "text" in line;
}

interface DisplaySource {
  description?: string;
  flags?: { desecrated?: boolean; fractured?: boolean };
  name?: string;
  values?: Array<[string] | string>;
}

function toDisplayText(item: unknown): string | null {
  if (!item) {
    return null;
  }
  if (typeof item === "string") {
    return item;
  }
  if (typeof item !== "object") {
    return String(item);
  }
  const source = item as DisplaySource;
  const description = String(source.description || "").trim();
  if (description) {
    return description;
  }
  const name = source.name ? String(source.name).trim() : "";
  const values = (source.values || [])
    .map((value) => (Array.isArray(value) ? value[0] : String(value)))
    .filter(Boolean)
    .join(", ");
  return name && values ? `${name}: ${values}` : name || values || null;
}

function toDisplayLines(items: unknown[] | undefined): string[] {
  return Array.isArray(items)
    ? items.map(toDisplayText).filter((line): line is string => Boolean(line))
    : [];
}

function toModDisplayLines(items: unknown[] | undefined): DisplayLine[] {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map((item): DisplayLine | null => {
      const text = toDisplayText(item);
      if (!text) {
        return null;
      }
      const source = typeof item === "object" && item !== null ? (item as DisplaySource) : null;
      if (source?.flags?.desecrated) {
        return { text, kind: "desecrated" };
      }
      return source?.flags?.fractured ? { text, kind: "fractured" } : text;
    })
    .filter((line): line is DisplayLine => line !== null);
}

function toLogbookLines(items: ItemDetails["logbookMods"]): string[] {
  if (!Array.isArray(items)) {
    return [];
  }
  const lines: string[] = [];
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

function normalizeRequirementToken(text: string | undefined): string {
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

function formatRequirementPart(requirement: unknown): string | null {
  if (!requirement || typeof requirement !== "object") {
    return null;
  }
  const source = requirement as { name?: string; values?: Array<[string] | string> };
  const name = normalizeRequirementToken(source.name);
  const value = (source.values || [])
    .map((entry) => (Array.isArray(entry) ? entry[0] : String(entry)))
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

function buildRequirementsLines(requirements: ItemDetails["requirements"]): DisplayLine[] {
  if (!Array.isArray(requirements) || requirements.length === 0) {
    return [];
  }
  if (requirements.every((entry) => typeof entry === "string")) {
    const joined = (requirements as string[]).filter(Boolean).join(", ").trim();
    if (!joined) {
      return [];
    }
    if (joined.toLowerCase().startsWith("requires:")) {
      return [joined];
    }
    return [{ label: "Requires:", value: joined, kind: "requires" }];
  }
  const parts = requirements
    .map((entry) => formatRequirementPart(entry))
    .filter(Boolean) as string[];
  if (!parts.length) {
    return [];
  }
  return [{ label: "Requires:", value: parts.join(", "), kind: "requires" }];
}

function resolveLineTone(line: DisplayLine, fallbackTone: string): string {
  if (isStyledTextLine(line)) {
    return line.kind;
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

function normalizeCorruptionLevelLine(line: DisplayLine, language: Language): DisplayLine {
  if (typeof line !== "string") {
    return line;
  }
  const match = line.match(/([+-]\d+)\s*Level from Corruption/i);
  if (!match) {
    return line;
  }
  const delta = match[1];
  if (language === "ja") {
    return `穢れにより${delta}レベル`;
  }
  return `${delta} Level from Corruption`;
}

function isCorruptionLevelLine(line: DisplayLine): boolean {
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

function isQualityLine(line: DisplayLine): boolean {
  if (typeof line !== "string") {
    return false;
  }
  return /quality/i.test(line) || line.includes("品質");
}

function reorderPropertyLines(lines: DisplayLine[], language: Language): DisplayLine[] {
  if (!Array.isArray(lines) || lines.length === 0) {
    return [];
  }
  const mapped = lines.map((line) => normalizeCorruptionLevelLine(line, language)).filter(Boolean);
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

function buildPropertySectionLines(detail: ItemDetails, language: Language): DisplayLine[] {
  const lines = reorderPropertyLines(toDisplayLines(detail.properties), language);
  const itemLevel = Number(detail.ilvl);
  const hasItemLevel =
    detail.ilvl !== null &&
    detail.ilvl !== undefined &&
    detail.ilvl !== "" &&
    !Number.isNaN(itemLevel) &&
    itemLevel > 0;
  if (hasItemLevel) {
    lines.push({
      label: `${t(language, "detailIlvl")}:`,
      value: itemLevel,
      kind: "item-level",
    });
  }
  return lines;
}

function isActiveSkillGem(detail: ItemDetails): boolean {
  return detail.frameType === 4 && detail.support === false;
}

function buildGemSocketsLines(detail: ItemDetails, language: Language): DisplayLine[] {
  if (!isActiveSkillGem(detail) || !Array.isArray(detail.gemSockets)) {
    return [];
  }
  const socketCount = detail.gemSockets.length;
  if (socketCount <= 0) {
    return [];
  }
  return [
    { label: `${t(language, "detailGemSockets")}:`, value: socketCount, kind: "gem-sockets-count" },
  ];
}

function buildDesecratedSectionLines(detail: ItemDetails, language: Language): DisplayLine[] {
  const lines: DisplayLine[] = toDisplayLines(detail.desecratedMods);
  const isDesecrated = detail.desecrated || detail.isDesecrated || detail.is_desecrated;
  if (isDesecrated && !lines.length) {
    lines.push({ text: t(language, "detailDesecratedMods"), kind: "desecrated-label" });
  }
  return lines;
}

function getCorruptionLabel(detail: ItemDetails, language: Language): string | null {
  const isDouble =
    detail.doubleCorrupted ||
    detail.double_corrupted ||
    detail.isDoubleCorrupted ||
    detail.is_double_corrupted;
  if (isDouble) {
    return t(language, "detailDoubleCorrupted");
  }
  const isCorrupted = detail.corrupted || detail.isCorrupted || detail.is_corrupted;
  if (isCorrupted) {
    return t(language, "detailCorrupted");
  }
  return null;
}

function normalizeRarity(rarity: string | undefined): string {
  const normalized = String(rarity || "normal")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  return normalized || "normal";
}

function normalizeSockets(sockets: ItemDetails["sockets"]): NormalizedSocket[] {
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

function computeSocketPoints(
  count: number,
  itemWidth: number | undefined,
  itemHeight: number | undefined
): SocketPoint[] {
  const width = Number(itemWidth) || 2;
  const height = Number(itemHeight) || 2;
  const vertical = height > width;
  const templatesVertical: SocketPoint[] = [
    { x: 50, y: 14 },
    { x: 50, y: 86 },
    { x: 26, y: 50 },
    { x: 74, y: 50 },
    { x: 26, y: 80 },
    { x: 74, y: 20 },
  ];
  const templatesHorizontal: SocketPoint[] = [
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

function renderItemVisual(detail: ItemDetails, language: Language): HTMLElement | null {
  const hasIcon = Boolean(detail.icon);
  const sockets = normalizeSockets(detail.sockets);
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
    icon.src = detail.icon || "";
    icon.alt = detail.typeLine || "item";
    visual.appendChild(icon);

    if (sockets.length) {
      const overlay = document.createElement("div");
      overlay.className = "socket-overlay";
      const points = computeSocketPoints(sockets.length, detail.w, detail.h);
      sockets.forEach((socket, index) => {
        const node = document.createElement("span");
        node.className = `socket-node socket-${socket.kind}`;
        node.style.setProperty("--socket-x", `${points[index].x}%`);
        node.style.setProperty("--socket-y", `${points[index].y}%`);
        node.title = `${t(language, "detailSockets")} #${index + 1}`;
        overlay.appendChild(node);
      });
      visual.appendChild(overlay);
    }

    section.appendChild(visual);
  }

  return section;
}

function appendRequiresValue(parent: HTMLElement, valueText: string): void {
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

function appendSection(
  body: HTMLElement,
  lines: DisplayLine[],
  tone: string,
  language: Language
): void {
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
    const lineTone = resolveLineTone(line, tone);
    p.className = `item-line item-line-${lineTone}`;
    if (isStyledTextLine(line)) {
      p.textContent = line.text;
      if (lineTone === "desecrated" || lineTone === "fractured") {
        const labelKey = lineTone === "desecrated" ? "detailDesecratedMod" : "detailFracturedMod";
        p.setAttribute("aria-label", `${t(language, labelKey)}: ${line.text}`);
      }
    } else if (isMetaLine(line)) {
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
  body.appendChild(section);
}

function toPropertyStatLine(property: unknown): string | null {
  if (!property || typeof property !== "object") {
    return null;
  }
  const source = property as { name?: string; values?: Array<[string] | string> };
  const name = String(source.name || "").trim();
  const values = (source.values || [])
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

function isLikelyRuneEffect(line: string): boolean {
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

function extractSocketedRuneEffects(detail: ItemDetails): string[] {
  if (!Array.isArray(detail.socketedItems)) {
    return [];
  }
  const lines: string[] = [];
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

function buildRuneSectionLines(detail: ItemDetails): string[] {
  const lines = [...toDisplayLines(detail.runeMods)];
  const fallbackLines = extractSocketedRuneEffects(detail);
  fallbackLines.forEach((line) => {
    if (!lines.includes(line)) {
      lines.push(line);
    }
  });
  return lines;
}

export class DetailRenderer {
  private previousFocus: HTMLElement | null = null;

  constructor(
    private readonly dom: ItemDetailDom,
    private readonly languageProvider: () => Language
  ) {
    this.dom.detailClose.addEventListener("click", () => this.hideDetail());
    this.dom.detailModal.addEventListener("click", (event) => {
      if (event.target === this.dom.detailModal) {
        this.hideDetail();
      }
    });
    this.dom.detailModal.addEventListener("close", () => {
      this.dom.detailModal.classList.add("hidden");
      this.restoreFocus();
    });
  }

  showDetail(record: TradeRecord): void {
    this.showItem(record.details_json || {}, record.item_name || "");
  }

  showItem(detail: ItemDetails, fallbackName: string): void {
    this.previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const language = this.languageProvider();
    const name = detail.name?.trim() || "";
    const typeLine = detail.typeLine?.trim() || fallbackName;
    const title = name || typeLine || "-";
    const subtitle = name && typeLine ? typeLine : detail.baseType?.trim() || "";

    this.dom.detailTitle.textContent = title;
    this.dom.detailSubtitle.textContent = subtitle;
    this.dom.detailSubtitle.hidden = !subtitle;
    this.dom.detailBody.innerHTML = "";
    this.dom.detailCard.dataset.rarity = normalizeRarity(detail.rarity);

    const visualSection = renderItemVisual(detail, language);
    if (visualSection) {
      this.dom.detailBody.appendChild(visualSection);
    }

    appendSection(
      this.dom.detailBody,
      buildPropertySectionLines(detail, language),
      "muted",
      language
    );
    appendSection(this.dom.detailBody, buildGemSocketsLines(detail, language), "muted", language);
    appendSection(
      this.dom.detailBody,
      buildRequirementsLines(detail.requirements),
      "muted",
      language
    );
    appendSection(
      this.dom.detailBody,
      toModDisplayLines(detail.enchantMods),
      "enchanted",
      language
    );
    appendSection(this.dom.detailBody, toModDisplayLines(detail.implicitMods), "magic", language);
    appendSection(this.dom.detailBody, buildRuneSectionLines(detail), "enchanted", language);
    appendSection(
      this.dom.detailBody,
      toModDisplayLines(detail.fracturedMods),
      "fractured",
      language
    );
    appendSection(this.dom.detailBody, toModDisplayLines(detail.explicitMods), "magic", language);
    appendSection(
      this.dom.detailBody,
      buildDesecratedSectionLines(detail, language),
      "desecrated",
      language
    );
    appendSection(this.dom.detailBody, toLogbookLines(detail.logbookMods), "muted", language);

    const corruptionStatus = getCorruptionLabel(detail, language);
    if (corruptionStatus) {
      appendSection(this.dom.detailBody, [corruptionStatus], "corrupted", language);
    }
    if (!this.dom.detailBody.children.length) {
      appendSection(this.dom.detailBody, [t(language, "detailNone")], "muted", language);
    }

    if (!this.dom.detailModal.open) {
      this.dom.detailModal.classList.remove("hidden");
      this.dom.detailModal.showModal();
    }
    this.dom.detailClose.focus();
  }

  hideDetail(): void {
    if (this.dom.detailModal.open) {
      this.dom.detailModal.close();
      return;
    }
    this.restoreFocus();
  }

  private restoreFocus(): void {
    if (this.previousFocus?.isConnected) {
      this.previousFocus.focus();
    }
    this.previousFocus = null;
  }
}
