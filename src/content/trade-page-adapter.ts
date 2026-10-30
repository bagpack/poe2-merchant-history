export function readInstantBuyoutCorrelation(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) {
    return null;
  }

  const control = target.closest("button.direct-btn");
  const row = control?.closest(".row[data-id]");
  if (!row?.querySelector('[data-field="fee"]')) {
    return null;
  }

  const correlationId = row.getAttribute("data-id");
  return correlationId?.trim() || null;
}

export function readTradeSearchId(pageUrl: string): string | null {
  try {
    const url = new URL(pageUrl);
    if (!TRADE_HOSTS.has(url.hostname)) {
      return null;
    }

    const segments = url.pathname.split("/").filter(Boolean);
    const searchId = segments[4];
    if (
      !isSearchPathLength(segments) ||
      segments[0] !== "trade2" ||
      segments[1] !== "search" ||
      segments[2] !== "poe2" ||
      !searchId ||
      !TRADE_SEARCH_ID_PATTERN.test(searchId)
    ) {
      return null;
    }
    return searchId;
  } catch {
    return null;
  }
}

// ライブ検索中は検索IDの後ろに"/live"が付く。
function isSearchPathLength(segments: string[]): boolean {
  return segments.length === 5 || (segments.length === 6 && segments[5] === "live");
}

// 検索URL末尾にはgzip+base64urlで符号化された検索条件が入り、フィルター数に応じて長くなる。
// 長さの妥当性はトレードサイト側に委ね、文字種だけを検証する。
const TRADE_SEARCH_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const TRADE_HOSTS = new Set(["pathofexile.com", "www.pathofexile.com", "jp.pathofexile.com"]);
