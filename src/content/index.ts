import { ItemCache } from "./item-cache.js";
import { parseNetworkItemBatchMessage } from "./network-message.js";
import { readInstantBuyoutCorrelation, readTradeSearchId } from "./trade-page-adapter.js";
import type { CapturedItem } from "../injected/types.js";
import type { PurchaseCandidateMessage } from "../purchase/types.js";

const itemCache = new ItemCache();
const unresolvedClicks = new Set<UnresolvedClick>();
const CLICK_RESOLUTION_TIMEOUT_MS = 15_000;
const NETWORK_CHANNEL = "poe2-purchase-history/network/v1" as const;

interface UnresolvedClick {
  correlationId: string;
  candidateAt: number;
  pageUrl: string;
  timeoutId: number;
}

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.source !== window || event.origin !== window.location.origin) {
    return;
  }

  const message = parseNetworkItemBatchMessage(event.data);
  if (message) {
    itemCache.putBatch(message.payload);
    resolvePendingClicks();
    console.debug(`[PoE2 Purchase History] Received ${message.payload.length} fetched items.`);
  }
});

// windowのcapture段階で受け取り、document以下で別拡張機能が伝播を止めても検出できるようにする。
window.addEventListener(
  "click",
  (event) => {
    if (!event.isTrusted) {
      return;
    }

    const correlationId = readInstantBuyoutCorrelation(event.target);
    if (!correlationId) {
      return;
    }

    const click = {
      correlationId,
      candidateAt: Date.now(),
      pageUrl: window.location.href,
    };
    const unresolvedClick: UnresolvedClick = {
      ...click,
      timeoutId: window.setTimeout(() => {
        unresolvedClicks.delete(unresolvedClick);
        console.warn("[PoE2 Purchase History] Click could not be matched to the fetched item.");
      }, CLICK_RESOLUTION_TIMEOUT_MS),
    };
    unresolvedClicks.add(unresolvedClick);
    requestItemRecovery(correlationId, click.pageUrl);
  },
  true
);

function resolvePendingClicks(): void {
  for (const click of unresolvedClicks) {
    const item = findCachedItem(click.correlationId);
    if (!item) {
      continue;
    }
    window.clearTimeout(click.timeoutId);
    unresolvedClicks.delete(click);
    saveCandidate(item, click.candidateAt, click.pageUrl);
  }
}

function findCachedItem(correlationId: string): CapturedItem | null {
  return itemCache.getByItemId(correlationId) ?? itemCache.getByResultId(correlationId);
}

function requestItemRecovery(itemId: string, pageUrl: string): void {
  const searchId = readTradeSearchId(pageUrl);
  if (!/^[a-f0-9]{64}$/.test(itemId) || !searchId) {
    return;
  }

  window.postMessage(
    JSON.stringify({
      channel: NETWORK_CHANNEL,
      type: "RECOVER_ITEM",
      payload: { itemId, searchId },
    }),
    window.location.origin
  );
}

function saveCandidate(item: CapturedItem, candidateAt: number, pageUrl: string): void {
  const message: PurchaseCandidateMessage = {
    type: "purchase/candidate",
    payload: {
      itemId: item.itemId,
      resultId: item.resultId,
      rawItem: item.rawItem,
      listingSnapshot: item.listingSnapshot,
      source: {
        pageUrl,
        fetchUrl: item.fetchUrl,
        language: document.documentElement.lang.trim() || null,
      },
      candidateAt,
    },
  };

  void chrome.runtime
    .sendMessage(message)
    .then((response: unknown) => {
      if ((response as { ok?: boolean } | null)?.ok !== true) {
        console.warn("[PoE2 Purchase History] Purchase candidate could not be saved.");
      }
    })
    .catch(() => {
      console.warn("[PoE2 Purchase History] Purchase candidate could not be saved.");
    });
}
