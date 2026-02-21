const LANGUAGE_STORAGE_KEY = "uiLanguage";

type Language = "en" | "ja";
type MessageParams = Record<string, string | number>;
type MessageMap = Record<string, string>;

type MessagesByLanguage = {
  [key in Language]: MessageMap;
};

const MESSAGES: MessagesByLanguage = {
  en: {
    appTitle: "PoE2 Merchant History",
    appSubtitle: "View history by league",
    labelLeague: "League",
    labelLanguage: "Language",
    languageEnglish: "English",
    languageJapanese: "Japanese",
    buttonRefresh: "Refresh",
    summaryTitle: "Totals",
    chartTitle: "Sales Trend",
    chartNote: "Daily by currency",
    tableTitle: "History",
    searchPlaceholder: "Search by item name",
    buttonCsv: "Export CSV",
    tableHeaderDate: "Date",
    tableHeaderItem: "Item",
    tableHeaderCurrency: "Currency",
    tableHeaderAmount: "Amount",
    buttonPrev: "Prev",
    buttonNext: "Next",
    modalClose: "Close",
    detailClose: "Close",
    detailBasicInfo: "Basic Info",
    detailProperties: "Properties",
    detailRequirements: "Requirements",
    detailImplicitMods: "Implicit Mods",
    detailRuneMods: "Rune Mods",
    detailExplicitMods: "Explicit Mods",
    detailDesecratedMods: "Desecrated Mods",
    detailLogbookMods: "Logbook Mods",
    detailNone: "None",
    detailTypeLine: "typeLine",
    detailRarity: "rarity",
    detailCorrupted: "Corrupted",
    detailDoubleCorrupted: "Double Corrupted",
    detailSockets: "sockets",
    detailGemSockets: "Gem Sockets",
    detailIlvl: "Item Level",
    totalsEmpty: "No data.",
    modalErrorTitle: "Error",
    modalUpdatedTitle: "Updated",
    modalUpdateFailed: "Update failed.",
    modalLeagueFetchFailed: "Failed to load leagues.",
    modalSelectLeague: "Please select a league.",
    modalNoExportData: "No data to export.",
    errorLeagueMismatch: "League mismatch. Expected: {expected} / Actual: {actual}",
    errorDuplicateId: "Duplicate ID detected. ID: {itemId} (Stopped)",
    errorFetchFailed: "Failed to fetch history. Please try again later.",
    errorAuthExpired: "Login expired. Please sign in again.",
    errorRateLimit: "Update is limited to once per minute. Wait {seconds} sec.",
    errorUnknown: "An unexpected error occurred.",
    updateResult: "Total {total} / Added {added}",
    csvHeaderDate: "Date",
    csvHeaderItem: "Item",
    csvHeaderCurrency: "Currency",
    csvHeaderAmount: "Amount",
    cookieTitle: "Cookie Status",
    cookieDesc: "Check cookies required to fetch PoE2 history.",
    cookieButtonRefresh: "Refresh",
    cookieStatusOk: "Available (expires: {date})",
    cookieStatusMissing: "Missing",
  },
  ja: {
    appTitle: "PoE2 Merchant History",
    appSubtitle: "リーグ別に履歴を確認",
    labelLeague: "リーグ",
    labelLanguage: "言語",
    languageEnglish: "English",
    languageJapanese: "日本語",
    buttonRefresh: "更新",
    summaryTitle: "総計",
    chartTitle: "売上推移",
    chartNote: "日次・通貨別",
    tableTitle: "履歴一覧",
    searchPlaceholder: "アイテム名で検索",
    buttonCsv: "CSV出力",
    tableHeaderDate: "日時",
    tableHeaderItem: "アイテム名",
    tableHeaderCurrency: "通貨",
    tableHeaderAmount: "個数",
    buttonPrev: "前へ",
    buttonNext: "次へ",
    modalClose: "閉じる",
    detailClose: "閉じる",
    detailBasicInfo: "基本情報",
    detailProperties: "properties",
    detailRequirements: "requirements",
    detailImplicitMods: "暗黙Mod",
    detailRuneMods: "runeMods",
    detailExplicitMods: "explicitMods",
    detailDesecratedMods: "desecratedMods",
    detailLogbookMods: "logbookMods",
    detailNone: "なし",
    detailTypeLine: "typeLine",
    detailRarity: "rarity",
    detailCorrupted: "コラプト",
    detailDoubleCorrupted: "ダブルコラプト",
    detailSockets: "sockets",
    detailGemSockets: "Gem Sockets",
    detailIlvl: "Item Level",
    totalsEmpty: "データがありません。",
    modalErrorTitle: "エラー",
    modalUpdatedTitle: "更新完了",
    modalUpdateFailed: "更新に失敗しました。",
    modalLeagueFetchFailed: "リーグ一覧の取得に失敗しました。",
    modalSelectLeague: "リーグを選択してください。",
    modalNoExportData: "エクスポートするデータがありません。",
    errorLeagueMismatch: "リーグが一致しません。期待: {expected} / 実際: {actual}",
    errorDuplicateId: "重複IDが検出されました。ID: {itemId}（処理を停止しました）",
    errorFetchFailed: "履歴の取得に失敗しました。時間をおいて再試行してください。",
    errorAuthExpired: "ログイン情報の有効期限が切れています。再ログインしてください。",
    errorRateLimit: "更新は1分に1回までです。あと{seconds}秒お待ちください。",
    errorUnknown: "予期しないエラーが発生しました。",
    updateResult: "総取得 {total} 件 / 追加 {added} 件",
    csvHeaderDate: "日時",
    csvHeaderItem: "アイテム名",
    csvHeaderCurrency: "通貨",
    csvHeaderAmount: "個数",
    cookieTitle: "Cookie状態",
    cookieDesc: "PoE2の履歴取得に必要なCookieを確認します。",
    cookieButtonRefresh: "再取得",
    cookieStatusOk: "取得済み (期限: {date})",
    cookieStatusMissing: "未取得",
  },
};

function toLanguage(input: string): Language {
  return input.startsWith("ja") ? "ja" : "en";
}

export function normalizeLanguage(lang: string | null | undefined): Language {
  if (!lang) {
    return "en";
  }
  return toLanguage(lang.toLowerCase());
}

export function getBrowserLanguage(): string {
  if (typeof chrome !== "undefined" && chrome.i18n?.getUILanguage) {
    return chrome.i18n.getUILanguage();
  }
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }
  return "en";
}

export function getDefaultLanguage(): Language {
  return normalizeLanguage(getBrowserLanguage());
}

export function loadUiLanguage(): Promise<Language> {
  return new Promise((resolve) => {
    chrome.storage.local.get([LANGUAGE_STORAGE_KEY], (data: Record<string, unknown>) => {
      resolve(normalizeLanguage(String(data[LANGUAGE_STORAGE_KEY] ?? getDefaultLanguage())));
    });
  });
}

export function saveUiLanguage(lang: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [LANGUAGE_STORAGE_KEY]: normalizeLanguage(lang) }, () => resolve());
  });
}

export function getLocaleForLanguage(lang: string): string {
  return normalizeLanguage(lang) === "ja" ? "ja-JP" : "en-US";
}

export function getHostForLanguage(lang: string): string {
  return normalizeLanguage(lang) === "ja" ? "jp.pathofexile.com" : "pathofexile.com";
}

export function getAcceptLanguage(lang: string): string {
  return normalizeLanguage(lang) === "ja" ? "ja,en-US;q=0.9,en;q=0.8" : "en-US,en;q=0.9";
}

export function t(lang: string, key: string, params: MessageParams = {}): string {
  const normalized = normalizeLanguage(lang);
  const template = MESSAGES[normalized][key] || MESSAGES.en[key] || key;
  return Object.entries(params).reduce(
    (message, [paramKey, paramValue]) => message.replaceAll(`{${paramKey}}`, String(paramValue)),
    template
  );
}

export function applyTranslations(root: ParentNode, lang: string): void {
  const normalized = normalizeLanguage(lang);

  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (!key) {
      return;
    }
    element.textContent = t(normalized, key);
  });

  root.querySelectorAll<HTMLElement>("[data-i18n-placeholder]").forEach((element) => {
    const key = element.dataset.i18nPlaceholder;
    if (!key) {
      return;
    }
    if ("placeholder" in element) {
      (element as HTMLInputElement).placeholder = t(normalized, key);
    }
  });
}
