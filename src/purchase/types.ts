import type { JsonObject, ListingSnapshot } from "../injected/types.js";

export type PurchaseStatus = "pending" | "purchased";
export type PurchaseUndoType = "mark-purchased" | "delete";

export interface PurchaseCandidateInput {
  itemId: string;
  resultId: string | null;
  rawItem: JsonObject;
  listingSnapshot: ListingSnapshot;
  source: {
    pageUrl: string;
    fetchUrl: string;
    language: string | null;
  };
  candidateAt: number;
}

export interface PurchaseCandidateMessage {
  type: "purchase/candidate";
  payload: PurchaseCandidateInput;
}

export interface ItemSummary {
  displayName: string;
  name: string | null;
  typeLine: string | null;
  baseType: string | null;
  rarity: string | null;
  itemLevel: number | null;
  iconUrl: string | null;
}

export interface PurchaseRecord {
  id: string;
  itemId: string;
  realm: string | null;
  league: string | null;
  language: string | null;
  rawItem: JsonObject;
  listingSnapshot: ListingSnapshot;
  summary: ItemSummary;
  source: {
    pageUrl: string;
    fetchUrl: string;
    searchId: string | null;
  };
  status: PurchaseStatus;
  candidateAt: number;
  purchasedAt: number | null;
  createdAt: number;
  updatedAt: number;
  schemaVersion: 1;
}

export interface PurchaseUndoAction {
  id: "latest";
  token: string;
  type: PurchaseUndoType;
  recordId: string;
  previousRecord: PurchaseRecord;
  appliedAt: number;
  expiresAt: number;
}

export interface PurchaseMutationResult {
  record: PurchaseRecord;
  undo: PurchaseUndoAction;
}

export interface PurchaseUndoResult {
  type: PurchaseUndoType;
  record: PurchaseRecord;
}
