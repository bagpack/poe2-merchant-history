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
      segments.length !== 5 ||
      segments[0] !== "trade2" ||
      segments[1] !== "search" ||
      segments[2] !== "poe2" ||
      !searchId ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(searchId)
    ) {
      return null;
    }
    return searchId;
  } catch {
    return null;
  }
}

const TRADE_HOSTS = new Set(["pathofexile.com", "www.pathofexile.com", "jp.pathofexile.com"]);
