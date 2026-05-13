import type { ObjectStore } from "../cas/ObjectStore.js";
import { ContentHash } from "../domain/ContentHash.js";
import { NotionBlockRequestFactory } from "../import/NotionBlockRequestFactory.js";
import { notionBlockPayloadFamily } from "../notion/NotionBlockTypeRegistry.js";
import type { LoadedCanonicalBlock } from "../snapshot/SnapshotLoader.js";
import {
  asArray,
  asRecordOrEmpty,
  booleanFlag,
  integerValue,
  nonEmptyStringValue,
  stringValue,
} from "./SnapshotVerifyNormalizerPrimitives.js";
import { SnapshotVerifyValueNormalizer } from "./SnapshotVerifyValueNormalizer.js";

interface LoadedCanonicalFileRefShape {
  canonical: {
    name: string;
  };
}

type BlockPayloadNormalizer = (blockType: string, payload: Record<string, unknown>) => Record<string, unknown>;

const BLOCK_PAYLOAD_NORMALIZERS: Record<string, BlockPayloadNormalizer> = {
  rich_text_color: normalizeRichTextColorPayload,
  callout: normalizeCalloutPayload,
  to_do: normalizeToDoPayload,
  divider: () => ({}),
  bookmark: normalizeBookmarkPayload,
  code: normalizeCodePayload,
  file: normalizeFilePayload,
  table: normalizeTablePayload,
  table_row: normalizeTableRowPayload,
};

function normalizeRichTextColorPayload(_: string, payload: Record<string, unknown>): Record<string, unknown> {
  return {
    rich_text: SnapshotVerifyValueNormalizer.richTextArray(payload.rich_text),
    color: SnapshotVerifyValueNormalizer.color(payload.color),
    ...(booleanFlag(payload.is_toggleable) ? { is_toggleable: true } : {}),
  };
}

function normalizeCalloutPayload(_: string, payload: Record<string, unknown>): Record<string, unknown> {
  const icon = SnapshotVerifyValueNormalizer.icon(payload.icon);

  return {
    rich_text: SnapshotVerifyValueNormalizer.richTextArray(payload.rich_text),
    color: SnapshotVerifyValueNormalizer.color(payload.color),
    ...(icon ? { icon } : {}),
  };
}

function normalizeToDoPayload(_: string, payload: Record<string, unknown>): Record<string, unknown> {
  return {
    rich_text: SnapshotVerifyValueNormalizer.richTextArray(payload.rich_text),
    color: SnapshotVerifyValueNormalizer.color(payload.color),
    checked: booleanFlag(payload.checked),
  };
}

function normalizeBookmarkPayload(_: string, payload: Record<string, unknown>): Record<string, unknown> {
  return {
    url: stringValue(payload.url) ?? "",
    caption: SnapshotVerifyValueNormalizer.richTextArray(payload.caption),
  };
}

function normalizeCodePayload(_: string, payload: Record<string, unknown>): Record<string, unknown> {
  return {
    rich_text: SnapshotVerifyValueNormalizer.richTextArray(payload.rich_text),
    caption: SnapshotVerifyValueNormalizer.richTextArray(payload.caption),
    language: nonEmptyStringValue(payload.language) ?? "plain text",
  };
}

function normalizeFilePayload(blockType: string, payload: Record<string, unknown>): Record<string, unknown> {
  const name = blockType === "file" ? nonEmptyStringValue(payload.name) : undefined;

  return {
    caption: SnapshotVerifyValueNormalizer.richTextArray(payload.caption),
    ...(name ? { name } : {}),
  };
}

function normalizeTablePayload(_: string, payload: Record<string, unknown>): Record<string, unknown> {
  return {
    has_column_header: booleanFlag(payload.has_column_header),
    has_row_header: booleanFlag(payload.has_row_header),
    table_width: integerValue(payload.table_width) ?? 0,
  };
}

function normalizeTableRowPayload(_: string, payload: Record<string, unknown>): Record<string, unknown> {
  return {
    cells: asArray(payload.cells).map((cell) => SnapshotVerifyValueNormalizer.richTextArray(cell)),
  };
}

export class SnapshotVerifyBlockNormalizer {
  public static async expectedPayload(
    block: LoadedCanonicalBlock,
    objectStore: ObjectStore,
  ): Promise<Record<string, unknown> | null> {
    const blockType = block.canonical.block_type;
    const payloadFamily = notionBlockPayloadFamily(blockType);

    if (payloadFamily === "table" || payloadFamily === "table_row") {
      return this.normalizePayload(blockType, block.canonical.payload);
    }

    if (payloadFamily === "file") {
      return this.expectedFilePayload(block, objectStore);
    }

    const request = NotionBlockRequestFactory.fromCanonicalBlock(block);

    if (!request) {
      return null;
    }

    return this.normalizePayload(
      blockType,
      (request as Record<string, unknown>)[blockType],
    );
  }

  public static actualPayload(blockType: string, block: Record<string, unknown>): Record<string, unknown> {
    return this.normalizePayload(blockType, block[blockType]);
  }

  private static normalizePayload(blockType: string, value: unknown): Record<string, unknown> {
    const payload = asRecordOrEmpty(value);
    const normalizer = BLOCK_PAYLOAD_NORMALIZERS[notionBlockPayloadFamily(blockType)];

    return normalizer ? normalizer(blockType, payload) : {};
  }

  private static async expectedFilePayload(
    block: LoadedCanonicalBlock,
    objectStore: ObjectStore,
  ): Promise<Record<string, unknown>> {
    const payload: Record<string, unknown> = {
      caption: SnapshotVerifyValueNormalizer.richTextArray(block.canonical.payload.caption),
    };
    const fileRefHash = block.canonical.payload.file_ref;

    if (block.canonical.block_type !== "file" || typeof fileRefHash !== "string") {
      return payload;
    }

    const fileRef = await objectStore.get<LoadedCanonicalFileRefShape>(ContentHash.parse(fileRefHash));
    return {
      ...payload,
      name: fileRef.canonical.name,
    };
  }
}
