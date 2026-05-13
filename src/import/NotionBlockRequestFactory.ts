import type { BlockObjectRequest } from "@notionhq/client";
import type { LoadedCanonicalBlock } from "../snapshot/SnapshotLoader.js";
import { isNotionFileBlockType, notionBlockPayloadFamily } from "../notion/NotionBlockTypeRegistry.js";
import { toRequestRichText, type RequestRichText } from "../notion/NotionRequestValueConverters.js";

interface CanonicalIcon {
  type?: string;
  emoji?: string;
  external?: {
    url?: string;
  };
  file_upload?: {
    id?: string;
  };
  custom_emoji?: {
    id?: string;
    name?: string;
    url?: string;
  };
  icon?: {
    name?: string;
    color?: string;
  };
}

type IconRequest =
  | {
      type: "emoji";
      emoji: string;
    }
  | {
      type: "external";
      external: {
        url: string;
      };
    }
  | {
      type: "file_upload";
      file_upload: {
        id: string;
      };
    }
  | {
      type: "custom_emoji";
      custom_emoji: {
        id: string;
        name?: string;
        url?: string;
      };
    };

type NotionColor =
  | "default"
  | "default_background"
  | "gray"
  | "brown"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "red"
  | "gray_background"
  | "brown_background"
  | "orange_background"
  | "yellow_background"
  | "green_background"
  | "blue_background"
  | "purple_background"
  | "pink_background"
  | "red_background";

type RichTextRequest = RequestRichText<NotionColor>;
type BlockRequestBuilder = (
  blockType: string,
  payload: Record<string, unknown>,
  childBlocks: LoadedCanonicalBlock[],
) => BlockObjectRequest | null;

export class NotionBlockRequestFactory {
  private static readonly BLOCK_REQUEST_BUILDERS: Readonly<Record<string, BlockRequestBuilder>> = {
    rich_text_color: (blockType, payload) =>
      NotionBlockRequestFactory.createBlockRequest(blockType, {
        rich_text: NotionBlockRequestFactory.toRichText(payload.rich_text),
        color: NotionBlockRequestFactory.toColor(payload.color),
        ...(NotionBlockRequestFactory.isToggleableHeading(blockType, payload)
          ? { is_toggleable: true }
          : {}),
      }),
    to_do: (blockType, payload) =>
      NotionBlockRequestFactory.createBlockRequest(blockType, {
        rich_text: NotionBlockRequestFactory.toRichText(payload.rich_text),
        color: NotionBlockRequestFactory.toColor(payload.color),
        checked: payload.checked === true,
      }),
    divider: (blockType) => NotionBlockRequestFactory.createBlockRequest(blockType, {}),
    bookmark: (blockType, payload) =>
      NotionBlockRequestFactory.createBlockRequest(blockType, {
        url: typeof payload.url === "string" ? payload.url : "",
        caption: NotionBlockRequestFactory.toRichText(payload.caption),
      }),
    code: (blockType, payload) =>
      NotionBlockRequestFactory.createBlockRequest(blockType, {
        rich_text: NotionBlockRequestFactory.toRichText(payload.rich_text),
        caption: NotionBlockRequestFactory.toRichText(payload.caption),
        language: NotionBlockRequestFactory.toLanguage(payload.language),
      }),
    callout: (blockType, payload) => {
      const icon = NotionBlockRequestFactory.toIcon(payload.icon);
      return NotionBlockRequestFactory.createBlockRequest(blockType, {
        rich_text: NotionBlockRequestFactory.toRichText(payload.rich_text),
        color: NotionBlockRequestFactory.toColor(payload.color),
        ...(icon ? { icon } : {}),
      });
    },
    child_reference: () => null,
    file: () => null,
    table: (blockType, payload, childBlocks) =>
      NotionBlockRequestFactory.createTableRequest(blockType, payload, childBlocks),
    table_row: (blockType, payload) =>
      NotionBlockRequestFactory.createBlockRequest(blockType, {
        cells: NotionBlockRequestFactory.toTableCells(payload.cells),
      }),
  };
  public static fromCanonicalBlock(
    block: LoadedCanonicalBlock,
    childBlocks: LoadedCanonicalBlock[] = [],
  ): BlockObjectRequest | null {
    const blockType = block.canonical.block_type;
    const payload = block.canonical.payload;
    const builder = this.BLOCK_REQUEST_BUILDERS[notionBlockPayloadFamily(blockType)];
    return builder ? builder(blockType, payload, childBlocks) : null;
  }

  public static fromCanonicalUploadedFileBlock(
    block: LoadedCanonicalBlock,
    fileUploadId: string,
    fileName?: string,
  ): BlockObjectRequest | null {
    const blockType = block.canonical.block_type;
    const payload = block.canonical.payload;
    if (!isNotionFileBlockType(blockType)) {
      return null;
    }

    return this.createBlockRequest(blockType, {
      type: "file_upload",
      file_upload: {
        id: fileUploadId,
      },
      caption: this.toRichText(payload.caption),
      ...(blockType === "file" && fileName ? { name: fileName } : {}),
    });
  }

  private static createBlockRequest(blockType: string, payload: Record<string, unknown>): BlockObjectRequest {
    return {
      object: "block",
      type: blockType,
      [blockType]: payload,
    } as BlockObjectRequest;
  }

  private static toRichText(value: unknown): RichTextRequest[] {
    return toRequestRichText(value, {
      toColor: (color) => NotionBlockRequestFactory.toColor(color),
      isTextContentUsable: (content) => content.length > 0,
      isEquationExpressionUsable: (expression) => expression.length > 0,
    });
  }

  private static isToggleableHeading(blockType: string, payload: Record<string, unknown>): boolean {
    return (
      (blockType === "heading_1" || blockType === "heading_2" || blockType === "heading_3") &&
      payload.is_toggleable === true
    );
  }

  private static createTableRequest(
    blockType: string,
    payload: Record<string, unknown>,
    childBlocks: LoadedCanonicalBlock[],
  ): BlockObjectRequest | null {
    const tableWidth = this.toTableWidth(payload.table_width, childBlocks);
    const rows = this.toTableRows(childBlocks, tableWidth);

    // Notion requires table rows to be supplied when the table is created.
    if (rows.length === 0) {
      return null;
    }

    return this.createBlockRequest(blockType, {
      table_width: tableWidth,
      has_column_header: payload.has_column_header === true,
      has_row_header: payload.has_row_header === true,
      children: rows,
    });
  }

  private static toTableRows(
    childBlocks: LoadedCanonicalBlock[],
    tableWidth: number,
  ): { type: "table_row"; table_row: { cells: RichTextRequest[][] } }[] {
    return childBlocks
      .filter((childBlock) => childBlock.canonical.block_type === "table_row")
      .map((childBlock) => ({
        type: "table_row" as const,
        table_row: {
          cells: NotionBlockRequestFactory.normalizeTableCells(
            NotionBlockRequestFactory.toTableCells(childBlock.canonical.payload.cells),
            tableWidth,
          ),
        },
      }));
  }

  private static toTableCells(value: unknown): RichTextRequest[][] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((cell) => NotionBlockRequestFactory.toRichText(cell));
  }

  private static normalizeTableCells(cells: RichTextRequest[][], tableWidth: number): RichTextRequest[][] {
    const normalized = cells.slice(0, tableWidth);

    while (normalized.length < tableWidth) {
      normalized.push([]);
    }

    return normalized;
  }

  private static toTableWidth(value: unknown, childBlocks: LoadedCanonicalBlock[]): number {
    if (typeof value === "number" && Number.isInteger(value) && value > 0) {
      return value;
    }

    const firstRow = childBlocks.find((childBlock) => childBlock.canonical.block_type === "table_row");
    const cells = firstRow?.canonical.payload.cells;
    return Array.isArray(cells) && cells.length > 0 ? cells.length : 1;
  }

  private static toIcon(value: unknown): IconRequest | undefined {
    const icon = NotionBlockRequestFactory.asCanonicalIcon(value);
    if (!icon) {
      return undefined;
    }

    if (!icon.type) {
      return undefined;
    }

    switch (icon.type) {
      case "emoji":
        return NotionBlockRequestFactory.toEmojiIcon(icon);
      case "external":
        return NotionBlockRequestFactory.toExternalIcon(icon);
      case "file_upload":
        return NotionBlockRequestFactory.toFileUploadIcon(icon);
      case "custom_emoji":
        return NotionBlockRequestFactory.toCustomEmojiIcon(icon);
      default:
        return undefined;
    }
  }

  private static asCanonicalIcon(value: unknown): CanonicalIcon | undefined {
    return value && typeof value === "object" ? value : undefined;
  }

  private static toEmojiIcon(icon: CanonicalIcon): IconRequest | undefined {
    return typeof icon.emoji === "string"
      ? {
          type: "emoji",
          emoji: icon.emoji,
        }
      : undefined;
  }

  private static toExternalIcon(icon: CanonicalIcon): IconRequest | undefined {
    const url = icon.external?.url;
    return typeof url === "string"
      ? {
          type: "external",
          external: { url },
        }
      : undefined;
  }

  private static toFileUploadIcon(icon: CanonicalIcon): IconRequest | undefined {
    const id = icon.file_upload?.id;
    return typeof id === "string"
      ? {
          type: "file_upload",
          file_upload: { id },
        }
      : undefined;
  }

  private static toCustomEmojiIcon(icon: CanonicalIcon): IconRequest | undefined {
    const id = icon.custom_emoji?.id;
    if (typeof id !== "string") {
      return undefined;
    }

    return {
      type: "custom_emoji",
      custom_emoji: {
        id,
        ...(typeof icon.custom_emoji?.name === "string" ? { name: icon.custom_emoji.name } : {}),
        ...(typeof icon.custom_emoji?.url === "string" ? { url: icon.custom_emoji.url } : {}),
      },
    };
  }

  private static toColor(value: unknown): NotionColor {
    const color = typeof value === "string" && value.length > 0 ? value : "default";

    if (NotionBlockRequestFactory.NOTION_COLORS.has(color as NotionColor)) {
      return color as NotionColor;
    }

    return "default";
  }

  private static toLanguage(value: unknown): string {
    return typeof value === "string" && value.length > 0 ? value : "plain text";
  }

  private static readonly NOTION_COLORS = new Set<NotionColor>([
    "default",
    "default_background",
    "gray",
    "brown",
    "orange",
    "yellow",
    "green",
    "blue",
    "purple",
    "pink",
    "red",
    "gray_background",
    "brown_background",
    "orange_background",
    "yellow_background",
    "green_background",
    "blue_background",
    "purple_background",
    "pink_background",
    "red_background",
  ]);
}
