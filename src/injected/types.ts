export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;

export interface JsonObject {
  [key: string]: JsonValue;
}

export interface PriceSnapshot {
  amount: number;
  currency: string;
  type: string | null;
}

export interface ListingSnapshot {
  resultId: string | null;
  price: PriceSnapshot | null;
  sellerAccount: string | null;
  indexedAt: string | null;
}

export interface CapturedItem {
  itemId: string;
  resultId: string | null;
  rawItem: JsonObject;
  listingSnapshot: ListingSnapshot;
  fetchUrl: string;
  capturedAt: number;
}

export interface ApiContext {
  fetchUrl: string;
  capturedAt: number;
}

export type NetworkChannel = "poe2-purchase-history/network/v1";

export interface NetworkItemBatchMessage {
  channel: NetworkChannel;
  type: "ITEM_BATCH";
  payload: CapturedItem[];
}

export interface NetworkRecoveryRequestMessage {
  channel: NetworkChannel;
  type: "RECOVER_ITEM";
  payload: {
    itemId: string;
    searchId: string;
  };
}
