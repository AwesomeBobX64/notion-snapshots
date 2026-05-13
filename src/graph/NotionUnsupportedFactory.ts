import { Sha256 } from "../cas/Sha256.js";

export interface CanonicalUnsupportedRecord {
  object_type: "notion.unsupported";
  schema_version: 1;
  content_hash: string;
  source: {
    id: string;
  };
  canonical: {
    kind: "block";
    original_type: string;
    reason: string;
    raw_ref: string;
    children_ref: string | null;
  };
}

export class NotionUnsupportedFactory {
  public static createUnsupportedBlock(input: {
    blockId: string;
    originalType: string;
    reason: string;
    rawRef: string;
    childrenRef?: string | null;
  }): CanonicalUnsupportedRecord {
    const payload: Omit<CanonicalUnsupportedRecord, "content_hash"> = {
      object_type: "notion.unsupported",
      schema_version: 1,
      source: {
        id: input.blockId,
      },
      canonical: {
        kind: "block",
        original_type: input.originalType,
        reason: input.reason,
        raw_ref: input.rawRef,
        children_ref: input.childrenRef ?? null,
      },
    };

    return {
      ...payload,
      content_hash: Sha256.hashCanonicalJson(payload).toString(),
    };
  }
}
