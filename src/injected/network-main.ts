import { postCapturedItems } from "./network-message.js";
import { parseSearchResponse } from "./trade-api-adapter.js";
import type { NetworkRecoveryRequestMessage } from "./types.js";

const NETWORK_CHANNEL = "poe2-purchase-history/network/v1" as const;
const recoveryRequests = new Set<string>();
const initialFetch = window.fetch;

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.source !== window || event.origin !== window.location.origin) {
    return;
  }

  const request = parseRecoveryRequest(event.data);
  if (!request) {
    return;
  }

  const { itemId, searchId } = request.payload;
  if (recoveryRequests.has(itemId)) {
    return;
  }

  recoveryRequests.add(itemId);
  const fetchUrl = new URL(`/api/trade2/fetch/${itemId}`, window.location.origin);
  fetchUrl.searchParams.set("query", searchId);
  fetchUrl.searchParams.set("realm", "poe2");

  void Reflect.apply(initialFetch, window, [fetchUrl, { credentials: "same-origin" }])
    .then(async (response) => {
      if (!response.ok) {
        return;
      }

      const items = parseSearchResponse(await response.json(), {
        fetchUrl: fetchUrl.href,
        capturedAt: Date.now(),
      }).filter((item) => item.itemId === itemId || item.resultId === itemId);
      postCapturedItems(items);
    })
    .catch(() => undefined)
    .finally(() => recoveryRequests.delete(itemId));
});

function parseRecoveryRequest(value: unknown): NetworkRecoveryRequestMessage | null {
  if (typeof value !== "string") {
    return null;
  }

  let message: unknown;
  try {
    message = JSON.parse(value) as unknown;
  } catch {
    return null;
  }

  if (
    !isRecord(message) ||
    message.channel !== NETWORK_CHANNEL ||
    message.type !== "RECOVER_ITEM"
  ) {
    return null;
  }
  const payload = message.payload;
  if (
    !isRecord(payload) ||
    Object.keys(payload).some((key) => !["itemId", "searchId"].includes(key)) ||
    typeof payload.itemId !== "string" ||
    !/^[a-f0-9]{64}$/.test(payload.itemId) ||
    typeof payload.searchId !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(payload.searchId)
  ) {
    return null;
  }
  return message as unknown as NetworkRecoveryRequestMessage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
