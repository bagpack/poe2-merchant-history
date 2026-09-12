import type { CapturedItem, NetworkItemBatchMessage } from "./types.js";

const NETWORK_CHANNEL = "poe2-purchase-history/network/v1" as const;

export function postCapturedItems(items: CapturedItem[]): void {
  if (items.length === 0) {
    return;
  }

  const message: NetworkItemBatchMessage = {
    channel: NETWORK_CHANNEL,
    type: "ITEM_BATCH",
    payload: items,
  };

  window.postMessage(JSON.stringify(message), window.location.origin);
}
