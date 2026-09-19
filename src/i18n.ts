const LANGUAGE_STORAGE_KEY = "uiLanguage";

type Language = "en" | "ja";
type MessageParams = Record<string, string | number>;
type MessageMap = Record<string, string>;

type MessagesByLanguage = {
  [key in Language]: MessageMap;
};

const MESSAGES: MessagesByLanguage = {
  en: {
    backupExporting: "Preparing backup…",
    backupChoosing: "Choose a backup file to restore.",
    backupRestoring: "Validating and restoring backup… Keep this page open.",
    backupCancelled: "Restore cancelled. Your data has not changed.",
    backupExportFailed:
      "Could not export the backup. Keep this page open and try Export Backup again. Your stored data has not changed.",
    backupExportDone: "Backup exported. Keep the downloaded file in a safe place.",
    backupImportDone: "Backup restored.",
    cookieChecking: "Checking saved sign-in information…",

    chartData: "Daily totals as a table",
    purchaseSummaryFailed: "Could not load candidates. Open purchase history to retry.",
    salesUpdating: "Updating sales history…",
    salesEmpty:
      "No sales saved for this league. Sign in on the official site, then select Refresh.",
    salesNoMatches: "No matching items. Change or clear the search text.",
    purchaseAdvancedFilters: "League and candidate dates",
    purchaseDateInvalid: "The end date must be on or after the start date.",
    purchaseResultCount: "{visible} shown / {total} records",
    purchaseTools: "Export and delete",
    purchaseExportCsv: "Export filtered CSV",
    purchaseRecordMetadata: "Dates, seller and trade search",
    purchaseHelpTitle: "How to record a purchase",
    purchaseHelpBody:
      "Instant purchase on the official trade site adds a candidate. Check the item and price, then mark it as purchased only after completing the trade. Delete candidates you did not buy. You can undo the latest confirmation or deletion for 30 seconds. Date filters use the candidate date.",
    cookieGuidance:
      "If missing, sign in on the official site, then return here and select Check again. A saved cookie does not guarantee a valid session; if fetching fails, sign in again.",
    cookieLogin: "Sign in on the official site",

    mainNavigation: "Main navigation",
    appTitle: "PoE2 Merchant History",
    appSubtitle: "View sales history by league",
    labelLeague: "League",
    labelLanguage: "Language",
    languageEnglish: "English",
    languageJapanese: "Japanese",
    buttonRefresh: "Refresh",
    purchasePendingTitle: "Pending purchases",
    purchasePendingUnit: "items",
    purchaseOpenHistory: "Open purchase history",
    purchaseHistoryTitle: "Purchase History",
    purchaseHistorySubtitle:
      "Purchase candidates are added automatically. Confirm the result manually.",
    purchaseFilterStatus: "Status",
    purchaseFilterName: "Item name",
    purchaseFilterLeague: "League",
    purchaseFilterFrom: "Candidate date from",
    purchaseFilterTo: "Candidate date to",
    purchaseClearFilters: "Clear filters",
    purchaseFilterAll: "All",
    purchaseFiltersLabel: "Filters",
    purchaseBackToSales: "Back to sales history",
    purchaseExportJson: "Export filtered JSON",
    purchaseDeleteAll: "Delete all purchase history",
    purchaseEmpty:
      "No purchase history. Use instant purchase on the official trade site to add a candidate.",
    purchaseNoMatches: "No purchase records match these filters. Change or clear the filters.",
    purchaseColumnStatus: "Status",
    purchaseColumnCandidateAt: "Candidate",
    purchaseColumnPurchasedAt: "Purchased",
    purchaseColumnItem: "Item",
    purchaseColumnBaseType: "Base type",
    purchaseColumnLevel: "Level",
    purchaseColumnPrice: "Price",
    purchaseColumnSeller: "Seller",
    purchaseColumnLeague: "League",
    purchaseColumnSearch: "Trade search",
    purchaseColumnActions: "Actions",
    purchaseStatusPending: "Pending",
    purchaseStatusPurchased: "Purchased",
    purchaseViewDetail: "View details",
    purchaseMarkPurchased: "Mark as purchased",
    purchaseDeleteCandidate: "Delete candidate",
    purchaseDeleteHistory: "Delete history",
    purchaseOpenSearch: "Open on trade site",
    purchaseConfirmDeleteAll:
      "Delete {count} purchase record(s)? They cannot be restored without a backup.",
    purchaseProcessing: "Processing…",
    purchaseMarkedPurchased: "Marked as purchased.",
    purchaseDeleted: "Deleted.",
    purchaseDeletedAll: "Deleted all purchase records.",
    purchaseUndo: "Undo",
    purchaseUndoMarkedPurchased: "{item} marked as purchased.",
    purchaseUndoDeleted: "{item} deleted.",
    purchaseUndoRemaining: "{seconds}s left. You can still undo.",
    purchaseUndoButtonLabel: "Undo the action for {item}",
    purchaseUndoExpired: "Undo expired.",
    purchaseUndone: "The last action was undone.",
    purchaseActionFailed: "The operation failed. Please try again.",
    summaryTitle: "Totals",
    chartTitle: "Sales Trend",
    chartNote: "Daily by currency",
    tableTitle: "Sales history",
    searchLabel: "Search by item name",
    pageSizeLabel: "Rows per page",
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
    detailDesecratedMod: "Desecrated mod",
    detailFracturedMod: "Fractured mod",
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
    modalUpdateFailed: "Update failed. Check your connection and try Refresh again.",
    modalLeagueFetchFailed: "Could not load leagues. Check your connection, then reload this page.",
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
    settingsTitle: "Settings",
    settingsDesc: "Manage connection status and backups.",
    cookieTitle: "Sign-in status",
    cookieDesc: "Check cookies required to fetch PoE2 history.",
    cookieButtonRefresh: "Check again",
    cookieStatusOk: "Available (expires: {date})",
    cookieStatusMissing: "Missing",
    backupTitle: "Backup & Restore",
    backupDesc:
      "Export/import settings, sales history, and purchase history when extension ID changes.",
    backupExport: "Export Backup",
    backupImport: "Restore from Backup",
    backupRestoreWarning:
      "Restoring replaces the current settings, sales history, and purchase history.",
    backupConfirmImport: "Import this backup? Existing data is replaced. Source: {extensionId}",
    backupDone: "Completed",
    backupFailed:
      "Could not process the backup. Check that the file was exported by this extension, keep your original backup, and try again.",
  },
  ja: {
    backupExporting: "バックアップを出力中…",
    backupChoosing: "復元するバックアップファイルを選択してください。",
    backupRestoring: "バックアップを検証・復元中です。この画面を閉じないでください。",
    backupCancelled: "復元をキャンセルしました。データは変更していません。",
    backupExportFailed:
      "バックアップを出力できませんでした。この画面を開いたまま、もう一度「バックアップ出力」を押してください。保存データは変更していません。",
    backupExportDone: "バックアップを出力しました。ダウンロードしたファイルを保管してください。",
    backupImportDone: "バックアップを復元しました。",
    cookieChecking: "保存されたログイン情報を確認中…",

    chartData: "日別の集計を表で確認",
    purchaseSummaryFailed: "候補を取得できませんでした。購入履歴を開いて再確認してください。",
    salesUpdating: "販売履歴を更新中…",
    salesEmpty:
      "このリーグの販売履歴はまだありません。公式サイトにログインして「更新」を押してください。",
    salesNoMatches: "一致するアイテムがありません。検索語を変更するか消してください。",
    purchaseAdvancedFilters: "リーグ・候補登録日",
    purchaseDateInvalid: "終了日は開始日以降にしてください。",
    purchaseResultCount: "{total}件中 {visible}件を表示",
    purchaseTools: "出力・全件削除",
    purchaseExportCsv: "表示中をCSV出力",
    purchaseRecordMetadata: "日時・出品者・トレード検索",
    purchaseHelpTitle: "購入の記録方法",
    purchaseHelpBody:
      "公式トレードの即時購入で候補が追加されます。アイテムと価格を確認し、取引完了後に「購入済みにする」を押してください。買わなかった候補は削除できます。直前の確定・削除は30秒間取り消せます。日付条件は候補登録日が対象です。",
    cookieGuidance:
      "未取得の場合は公式サイトにログインし、この画面に戻って「再確認」を押してください。Cookieがあってもログインが失効していることがあります。履歴を取得できない場合は再ログインしてください。",
    cookieLogin: "公式サイトにログイン",

    mainNavigation: "メインナビゲーション",
    appTitle: "PoE2 Merchant History",
    appSubtitle: "リーグ別の販売履歴を確認",
    labelLeague: "リーグ",
    labelLanguage: "言語",
    languageEnglish: "English",
    languageJapanese: "日本語",
    buttonRefresh: "更新",
    purchasePendingTitle: "購入候補",
    purchasePendingUnit: "件",
    purchaseOpenHistory: "購入履歴を開く",
    purchaseHistoryTitle: "購入履歴",
    purchaseHistorySubtitle: "購入候補は自動で追加されます。購入結果は手動で確定してください。",
    purchaseFilterStatus: "状態",
    purchaseFilterName: "アイテム名",
    purchaseFilterLeague: "リーグ",
    purchaseFilterFrom: "候補登録日の開始",
    purchaseFilterTo: "候補登録日の終了",
    purchaseClearFilters: "絞り込みを解除",
    purchaseFilterAll: "すべて",
    purchaseFiltersLabel: "絞り込み",
    purchaseBackToSales: "販売履歴へ戻る",
    purchaseExportJson: "表示中をJSON出力",
    purchaseDeleteAll: "購入履歴を全件削除",
    purchaseEmpty:
      "購入履歴はありません。公式トレードサイトで即時購入を行うと、購入候補が追加されます。",
    purchaseNoMatches: "条件に一致する購入履歴がありません。絞り込み条件を変更してください。",
    purchaseColumnStatus: "状態",
    purchaseColumnCandidateAt: "候補登録日時",
    purchaseColumnPurchasedAt: "購入日時",
    purchaseColumnItem: "アイテム",
    purchaseColumnBaseType: "ベースタイプ",
    purchaseColumnLevel: "レベル",
    purchaseColumnPrice: "価格",
    purchaseColumnSeller: "出品者",
    purchaseColumnLeague: "リーグ",
    purchaseColumnSearch: "トレード検索",
    purchaseColumnActions: "操作",
    purchaseStatusPending: "未確定",
    purchaseStatusPurchased: "購入済み",
    purchaseViewDetail: "詳細を見る",
    purchaseMarkPurchased: "購入済みにする",
    purchaseDeleteCandidate: "候補から削除",
    purchaseDeleteHistory: "履歴から削除",
    purchaseOpenSearch: "公式サイトで開く",
    purchaseConfirmDeleteAll:
      "購入履歴{count}件をすべて削除しますか？バックアップがない場合は復元できません。",
    purchaseProcessing: "処理中…",
    purchaseMarkedPurchased: "購入済みにしました。",
    purchaseDeleted: "削除しました。",
    purchaseDeletedAll: "購入履歴をすべて削除しました。",
    purchaseUndo: "取り消す",
    purchaseUndoMarkedPurchased: "{item}を購入済みにしました。",
    purchaseUndoDeleted: "{item}を削除しました。",
    purchaseUndoRemaining: "残り{seconds}秒。取り消せます。",
    purchaseUndoButtonLabel: "{item}の操作を取り消す",
    purchaseUndoExpired: "取り消し期限が切れました。",
    purchaseUndone: "直前の操作を取り消しました。",
    purchaseActionFailed: "操作に失敗しました。もう一度お試しください。",
    summaryTitle: "総計",
    chartTitle: "売上推移",
    chartNote: "日次・通貨別",
    tableTitle: "販売履歴",
    searchLabel: "アイテム名を検索",
    pageSizeLabel: "1ページの表示件数",
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
    detailProperties: "プロパティ",
    detailRequirements: "必要条件",
    detailImplicitMods: "暗黙Mod",
    detailRuneMods: "ルーンMod",
    detailExplicitMods: "明示Mod",
    detailDesecratedMods: "冒涜されたMod",
    detailDesecratedMod: "冒涜されたMod",
    detailFracturedMod: "フラクトされたMod",
    detailLogbookMods: "ログブックMod",
    detailNone: "なし",
    detailTypeLine: "種別",
    detailRarity: "レアリティ",
    detailCorrupted: "コラプト",
    detailDoubleCorrupted: "ダブルコラプト",
    detailSockets: "ソケット",
    detailGemSockets: "ジェムソケット",
    detailIlvl: "アイテムレベル",
    totalsEmpty: "データがありません。",
    modalErrorTitle: "エラー",
    modalUpdatedTitle: "更新完了",
    modalUpdateFailed:
      "更新できませんでした。通信状態を確認して、もう一度「更新」を押してください。",
    modalLeagueFetchFailed:
      "リーグ一覧を取得できませんでした。通信状態を確認して、この画面を再読み込みしてください。",
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
    settingsTitle: "設定",
    settingsDesc: "接続状態とバックアップを管理します。",
    cookieTitle: "ログイン状態",
    cookieDesc: "PoE2の履歴取得に必要なCookieを確認します。",
    cookieButtonRefresh: "再確認",
    cookieStatusOk: "取得済み (期限: {date})",
    cookieStatusMissing: "未取得",
    backupTitle: "バックアップ / 復元",
    backupDesc: "拡張ID変更時に備えて、設定・販売履歴・購入履歴をエクスポート/インポートします。",
    backupExport: "バックアップ出力",
    backupImport: "バックアップから復元",
    backupRestoreWarning: "復元すると現在の設定・販売履歴・購入履歴を置き換えます。",
    backupConfirmImport:
      "バックアップを読み込みますか？現在のデータは置き換えられます。取得元: {extensionId}",
    backupDone: "完了",
    backupFailed:
      "バックアップを処理できませんでした。この拡張から出力したファイルか確認し、元のバックアップを保管して再試行してください。",
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

  root.querySelectorAll<HTMLElement>("[data-i18n-aria-label]").forEach((element) => {
    const key = element.dataset.i18nAriaLabel;
    if (key) {
      element.setAttribute("aria-label", t(normalized, key));
    }
  });
}
