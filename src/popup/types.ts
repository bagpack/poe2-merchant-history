export type Language = "en" | "ja";
export type UpdateRequestSource = "user" | "automatic";

export interface LeagueOption {
  id: string;
  text: string;
}

export interface HistoryErrorMeta {
  expectedLeague?: string;
  actualLeague?: string;
  itemId?: string;
  remainingSec?: number;
}

export interface HistoryErrorPayload {
  code?: string;
  message?: string;
  meta?: HistoryErrorMeta;
}

export interface HistoryResponsePayload {
  ok?: boolean;
  result?: {
    addedCount?: number;
    fetchedCount?: number;
    totalCount?: number;
  };
  error?: HistoryErrorPayload;
}

export interface ValuePair {
  0: string;
  1?: number;
}

export interface PropertyEntry {
  name?: string;
  values?: Array<ValuePair | string>;
}

export interface RequirementEntry {
  name?: string;
  values?: Array<ValuePair | string>;
}

export interface SocketEntry {
  group?: number;
  type?: string;
  kind?: string;
}

export interface SocketedItemEntry {
  name?: string;
  typeLine?: string;
  runeMods?: unknown[];
  properties?: PropertyEntry[];
}

export interface ItemDetails {
  name?: string;
  typeLine?: string;
  baseType?: string;
  rarity?: string;
  ilvl?: number | string;
  icon?: string;
  w?: number;
  h?: number;
  frameType?: number;
  support?: boolean;
  gemSockets?: string[];
  properties?: unknown[];
  requirements?: RequirementEntry[] | string[];
  implicitMods?: unknown[];
  runeMods?: unknown[];
  fracturedMods?: unknown[];
  explicitMods?: unknown[];
  desecratedMods?: unknown[];
  logbookMods?: Array<{ name?: string; mods?: string[] }>;
  enchantMods?: unknown[];
  socketedItems?: SocketedItemEntry[];
  sockets?: SocketEntry[];
  doubleCorrupted?: boolean;
  double_corrupted?: boolean;
  isDoubleCorrupted?: boolean;
  is_double_corrupted?: boolean;
  corrupted?: boolean;
  isCorrupted?: boolean;
  is_corrupted?: boolean;
  desecrated?: boolean;
  isDesecrated?: boolean;
  is_desecrated?: boolean;
}

export interface TradeRecord {
  id: string;
  item_name?: string;
  item_name_unique?: string | null;
  currency?: string;
  amount?: number;
  time: string;
  details_json?: ItemDetails;
  _timeMs?: number;
}

export interface MetaLine {
  label: string;
  value: string | number;
  kind?: string;
}

export interface StyledTextLine {
  text: string;
  kind: string;
}

export type DisplayLine = string | MetaLine | StyledTextLine;

export interface ItemDetailDom {
  detailModal: HTMLDialogElement;
  detailClose: HTMLButtonElement;
  detailTitle: HTMLElement;
  detailSubtitle: HTMLElement;
  detailBody: HTMLElement;
  detailCard: HTMLElement;
}

export interface PopupDom extends ItemDetailDom {
  purchasePendingCount: HTMLElement;
  purchasePendingList: HTMLUListElement;
  leagueSelect: HTMLSelectElement;
  refreshButton: HTMLButtonElement;
  historyBody: HTMLTableSectionElement;
  searchInput: HTMLInputElement;
  pageSizeSelect: HTMLSelectElement;
  csvExportButton: HTMLButtonElement;
  prevPageButton: HTMLButtonElement;
  nextPageButton: HTMLButtonElement;
  pageInfo: HTMLElement;
  modal: HTMLDialogElement;
  modalTitle: HTMLElement;
  modalMessage: HTMLElement;
  modalClose: HTMLButtonElement;
  salesRail: HTMLElement;
  chartDataBody: HTMLTableSectionElement;
  daySummary: HTMLElement;
  showAllDatesButton: HTMLButtonElement;
  selectedDateLabel: HTMLElement;
  chartSection: HTMLElement;
}
