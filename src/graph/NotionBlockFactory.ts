import type { BlockObjectResponse, PartialBlockObjectResponse } from "@notionhq/client";
import type { ContentHash } from "../domain/ContentHash.js";
import { Sha256 } from "../cas/Sha256.js";
import { notionBlockPayloadFamily, notionChildReferenceKey } from "../notion/NotionBlockTypeRegistry.js";
import { NotionRichText } from "./NotionRichText.js";

export interface RawNotionBlockRecord {
  object_type: "raw.notion.block";
  schema_version: 1;
  content_hash: string;
  source: {
    id: string;
    fetched_at: string;
  };
  payload: BlockObjectResponse | Record<string, unknown>;
}

export interface CanonicalNotionBlockRecord {
  object_type: "notion.block";
  schema_version: 1;
  content_hash: string;
  source: {
    id: string;
  };
  canonical: {
    block_type: string;
    payload: Record<string, unknown>;
    children_ref: string | null;
  };
}

export interface CanonicalChildrenRecord {
  object_type: "notion.children";
  schema_version: 1;
  content_hash: string;
  children: {
    source_id: string;
    ref: string;
  }[];
}

type NotionBlockLike = BlockObjectResponse | PartialBlockObjectResponse | Record<string, unknown>;
type BlockPayloadNormalizer = (
  blockType: string,
  rawPayload: unknown,
  fileRef: string | null,
  pageRef: string | null,
  databaseRef: string | null,
) => Record<string, unknown>;

export class NotionBlockFactory {
  private static readonly BLOCK_PAYLOAD_NORMALIZERS: Readonly<Record<string, BlockPayloadNormalizer>> = {
    rich_text_color: (_, rawPayload) => NotionBlockFactory.normalizeRichTextColorPayload(rawPayload),
    to_do: (_, rawPayload) => ({
      ...NotionBlockFactory.normalizeRichTextColorPayload(rawPayload),
      checked: Boolean(NotionRichText.pick(rawPayload, "checked")),
    }),
    divider: () => ({}),
    callout: (_, rawPayload) => ({
      ...NotionBlockFactory.normalizeRichTextColorPayload(rawPayload),
      icon: NotionBlockFactory.cloneObjectOrNull(NotionRichText.pick(rawPayload, "icon")),
    }),
    code: (_, rawPayload) => ({
      rich_text: NotionRichText.normalizeArray(NotionRichText.pick(rawPayload, "rich_text")),
      caption: NotionRichText.normalizeArray(NotionRichText.pick(rawPayload, "caption")),
      language: NotionBlockFactory.pickString(rawPayload, "language", "plain text"),
    }),
    bookmark: (_, rawPayload) => ({
      url: NotionBlockFactory.pickString(rawPayload, "url", ""),
      caption: NotionRichText.normalizeArray(NotionRichText.pick(rawPayload, "caption")),
    }),
    file: (_, rawPayload, fileRef) => ({
      caption: NotionRichText.normalizeArray(NotionRichText.pick(rawPayload, "caption")),
      file_ref: fileRef,
    }),
    child_reference: (blockType, rawPayload, _, pageRef, databaseRef) =>
      NotionBlockFactory.normalizeChildReferencePayload(blockType, rawPayload, pageRef, databaseRef),
    table: (_, rawPayload) => ({
      has_column_header: Boolean(NotionRichText.pick(rawPayload, "has_column_header")),
      has_row_header: Boolean(NotionRichText.pick(rawPayload, "has_row_header")),
      table_width: NotionBlockFactory.pickNumber(rawPayload, "table_width", 0),
    }),
    table_row: (_, rawPayload) => {
      const cells = NotionRichText.pick(rawPayload, "cells");
      return {
        cells: Array.isArray(cells)
          ? cells.map((cell) => NotionRichText.normalizeArray(cell))
          : [],
      };
    },
  };
  public static blockTypeOrNull(block: NotionBlockLike): string | null {
    const type = NotionRichText.pick(block, "type");
    return typeof type === "string" && type.length > 0 ? type : null;
  }

  public static isCanonicalizableBlock(block: NotionBlockLike): boolean {
    const blockType = NotionBlockFactory.blockTypeOrNull(block);

    if (!blockType) {
      return false;
    }

    return NotionRichText.pick(block, blockType) !== undefined;
  }

  public static createRawBlock(
    block: NotionBlockLike,
    fetchedAt: string,
  ): RawNotionBlockRecord {
    const payload: Omit<RawNotionBlockRecord, "content_hash"> = {
      object_type: "raw.notion.block",
      schema_version: 1,
      source: {
        id: NotionBlockFactory.blockId(block),
        fetched_at: fetchedAt,
      },
      payload: block,
    };

    return {
      ...payload,
      content_hash: Sha256.hashCanonicalJson(payload).toString(),
    };
  }

  public static createCanonicalBlock(
    block: NotionBlockLike,
    childrenRef: ContentHash | null,
    fileRef: string | null = null,
    pageRef: string | null = null,
    databaseRef: string | null = null,
  ): CanonicalNotionBlockRecord {
    const blockType = NotionBlockFactory.blockType(block);
    const blockPayload = NotionRichText.pick(block, blockType);

    const canonical: Omit<CanonicalNotionBlockRecord, "content_hash"> = {
      object_type: "notion.block",
      schema_version: 1,
      source: {
        id: NotionBlockFactory.blockId(block),
      },
      canonical: {
        block_type: blockType,
        payload: NotionBlockFactory.normalizeBlockPayload(
          blockType,
          blockPayload,
          fileRef,
          pageRef,
          databaseRef,
        ),
        children_ref: childrenRef?.toString() ?? null,
      },
    };

    return {
      ...canonical,
      content_hash: Sha256.hashCanonicalJson(canonical).toString(),
    };
  }

  public static createChildrenObject(
    children: { source_id: string; ref: string }[],
  ): CanonicalChildrenRecord {
    const payload: Omit<CanonicalChildrenRecord, "content_hash"> = {
      object_type: "notion.children",
      schema_version: 1,
      children,
    };

    return {
      ...payload,
      content_hash: Sha256.hashCanonicalJson(payload).toString(),
    };
  }

  private static normalizeBlockPayload(
    blockType: string,
    rawPayload: unknown,
    fileRef: string | null = null,
    pageRef: string | null = null,
    databaseRef: string | null = null,
  ): Record<string, unknown> {
    const normalizer = this.BLOCK_PAYLOAD_NORMALIZERS[notionBlockPayloadFamily(blockType)];
    return normalizer
      ? normalizer(blockType, rawPayload, fileRef, pageRef, databaseRef)
      : structuredClone((rawPayload as Record<string, unknown> | undefined) ?? {});
  }

  private static normalizeRichTextColorPayload(rawPayload: unknown): Record<string, unknown> {
    const isToggleable = NotionRichText.pick(rawPayload, "is_toggleable") === true;

    return {
      rich_text: NotionRichText.normalizeArray(NotionRichText.pick(rawPayload, "rich_text")),
      color: this.pickString(rawPayload, "color", "default"),
      ...(isToggleable ? { is_toggleable: true } : {}),
    };
  }

  private static normalizeChildReferencePayload(
    blockType: string,
    rawPayload: unknown,
    pageRef: string | null,
    databaseRef: string | null,
  ): Record<string, unknown> {
    const referenceKey = notionChildReferenceKey(blockType);
    const referenceValue = referenceKey === "page_ref" ? pageRef : databaseRef;

    return {
      title: this.pickString(rawPayload, "title", ""),
      ...(referenceKey ? { [referenceKey]: referenceValue } : {}),
    };
  }

  private static pickString(payload: unknown, key: string, fallback: string): string {
    const value = NotionRichText.pick(payload, key);
    return typeof value === "string" ? value : fallback;
  }

  private static pickNumber(payload: unknown, key: string, fallback: number): number {
    const value = NotionRichText.pick(payload, key);
    return typeof value === "number" ? value : fallback;
  }

  private static cloneObjectOrNull(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object"
      ? structuredClone(value as Record<string, unknown>)
      : null;
  }

  private static blockId(block: NotionBlockLike): string {
    const id = NotionRichText.pick(block, "id");

    if (typeof id !== "string" || id.length === 0) {
      throw new Error("Notion block payload is missing an id");
    }

    return id;
  }

  private static blockType(block: NotionBlockLike): string {
    const type = NotionBlockFactory.blockTypeOrNull(block);

    if (!type) {
      throw new Error("Notion block payload is missing a type");
    }

    return type;
  }
}
