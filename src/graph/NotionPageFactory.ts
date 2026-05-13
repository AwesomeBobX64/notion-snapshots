import type {
  PageObjectResponse,
  PartialPageObjectResponse,
} from "@notionhq/client";
import type { ContentHash } from "../domain/ContentHash.js";
import { Sha256 } from "../cas/Sha256.js";
import { NotionRichText } from "./NotionRichText.js";
import { NotionPagePropertyCodec } from "../notion/NotionPagePropertyCodec.js";

export interface RawNotionPageRecord {
  object_type: "raw.notion.page";
  schema_version: 1;
  content_hash: string;
  source: {
    id: string;
    fetched_at: string;
  };
  payload: PageObjectResponse | Record<string, unknown>;
}

export interface CanonicalNotionPageRecord {
  object_type: "notion.page";
  schema_version: 1;
  content_hash: string;
  source: {
    id: string;
  };
  canonical: {
    title: {
      type: string;
      plain_text: string;
      annotations: {
        bold: boolean;
        italic: boolean;
        strikethrough: boolean;
        underline: boolean;
        code: boolean;
        color: string;
      };
    }[];
    icon: Record<string, unknown> | null;
    cover: Record<string, unknown> | null;
    properties: Record<string, unknown>;
    children_ref: string | null;
  };
}

type NotionPageLike = PageObjectResponse | PartialPageObjectResponse | Record<string, unknown>;

export class NotionPageFactory {
  public static createRawPage(
    page: NotionPageLike,
    fetchedAt: string,
  ): RawNotionPageRecord {
    const payload: Omit<RawNotionPageRecord, "content_hash"> = {
      object_type: "raw.notion.page",
      schema_version: 1 as const,
      source: {
        id: NotionPageFactory.pageId(page),
        fetched_at: fetchedAt,
      },
      payload: page,
    };

    return {
      ...payload,
      content_hash: Sha256.hashCanonicalJson(payload).toString(),
    };
  }

  public static createCanonicalPage(
    page: NotionPageLike,
    childrenRef: ContentHash | null = null,
    fileRefs?: {
      icon?: string | null;
      cover?: string | null;
      properties?: Record<string, (string | null)[]>;
    },
  ): CanonicalNotionPageRecord {
    const canonical: Omit<CanonicalNotionPageRecord, "content_hash"> = {
      object_type: "notion.page" as const,
      schema_version: 1 as const,
      source: {
        id: NotionPageFactory.pageId(page),
      },
      canonical: {
        title: NotionPageFactory.extractTitle(page),
        icon: NotionPagePropertyCodec.normalizeIcon(NotionPageFactory.pick(page, "icon"), fileRefs?.icon),
        cover: NotionPagePropertyCodec.normalizeCover(NotionPageFactory.pick(page, "cover"), fileRefs?.cover),
        properties: NotionPagePropertyCodec.normalizeProperties(
          NotionPageFactory.pick(page, "properties"),
          fileRefs?.properties,
        ),
        children_ref: childrenRef?.toString() ?? null,
      },
    };

    return {
      ...canonical,
      content_hash: Sha256.hashCanonicalJson(canonical).toString(),
    };
  }

  private static pageId(page: NotionPageLike): string {
    const id = NotionPageFactory.pick(page, "id");

    if (typeof id !== "string" || id.length === 0) {
      throw new Error("Notion page payload is missing an id");
    }

    return id;
  }

  private static extractTitle(page: NotionPageLike): CanonicalNotionPageRecord["canonical"]["title"] {
    const properties = NotionPageFactory.pick(page, "properties");

    if (!properties || typeof properties !== "object") {
      return [];
    }

    const titleProperty = Object.values(properties as Record<string, unknown>).find((property) => {
      if (!property || typeof property !== "object") {
        return false;
      }

      return NotionPageFactory.pick(property, "type") === "title";
    });

    return NotionRichText.normalizeArray(NotionPageFactory.pick(titleProperty, "title"));
  }

  private static pick(value: unknown, key: string): unknown {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    return (value as Record<string, unknown>)[key];
  }
}
