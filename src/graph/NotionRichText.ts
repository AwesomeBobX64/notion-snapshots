import type { RichTextItemResponse } from "@notionhq/client";

export interface CanonicalRichText {
  type: string;
  plain_text: string;
  href?: string | null;
  text?: {
    content: string;
    link: {
      url: string;
    } | null;
  };
  equation?: {
    expression: string;
  };
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: string;
  };
}

export class NotionRichText {
  public static normalizeArray(value: unknown): CanonicalRichText[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => NotionRichText.normalize(item as RichTextItemResponse | Record<string, unknown>))
      .filter((item): item is CanonicalRichText => item !== null);
  }

  public static normalize(
    item: RichTextItemResponse | Record<string, unknown>,
  ): CanonicalRichText | null {
    const type = NotionRichText.pick(item, "type");
    const plainText = NotionRichText.pick(item, "plain_text");
    const href = NotionRichText.pick(item, "href");
    const annotations = NotionRichText.pick(item, "annotations");

    if (typeof type !== "string" || typeof plainText !== "string") {
      return null;
    }

    const text = NotionRichText.normalizeTextContent(type, NotionRichText.pick(item, "text"), plainText);
    const equation = NotionRichText.normalizeEquationContent(
      type,
      NotionRichText.pick(item, "equation"),
    );

    return {
      type,
      plain_text: plainText,
      href: typeof href === "string" ? href : null,
      ...(text ? { text } : {}),
      ...(equation ? { equation } : {}),
      annotations:
        annotations && typeof annotations === "object"
          ? {
              bold: Boolean(NotionRichText.pick(annotations, "bold")),
              italic: Boolean(NotionRichText.pick(annotations, "italic")),
              strikethrough: Boolean(NotionRichText.pick(annotations, "strikethrough")),
              underline: Boolean(NotionRichText.pick(annotations, "underline")),
              code: Boolean(NotionRichText.pick(annotations, "code")),
              color:
                typeof NotionRichText.pick(annotations, "color") === "string"
                  ? (NotionRichText.pick(annotations, "color") as string)
                  : "default",
            }
          : {
              bold: false,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false,
              color: "default",
            },
    };
  }

  private static normalizeTextContent(
    type: string,
    value: unknown,
    plainText: string,
  ): CanonicalRichText["text"] | undefined {
    if (type !== "text") {
      return undefined;
    }

    const content = NotionRichText.pickString(value, "content") ?? plainText;
    const linkUrl = NotionRichText.linkUrlFromValue(value);

    return {
      content,
      link: linkUrl ? { url: linkUrl } : null,
    };
  }

  private static normalizeEquationContent(
    type: string,
    value: unknown,
  ): CanonicalRichText["equation"] | undefined {
    if (type !== "equation") {
      return undefined;
    }

    const expression =
      value && typeof value === "object" && typeof NotionRichText.pick(value, "expression") === "string"
        ? (NotionRichText.pick(value, "expression") as string)
        : null;

    return expression ? { expression } : undefined;
  }

  private static linkUrlFromValue(value: unknown): string | null {
    if (!value || typeof value !== "object") {
      return null;
    }

    const rawLink = NotionRichText.pick(value, "link");
    return NotionRichText.pickString(rawLink, "url") ?? null;
  }

  private static pickString(value: unknown, key: string): string | undefined {
    const picked = NotionRichText.pick(value, key);
    return typeof picked === "string" ? picked : undefined;
  }

  public static pick(value: unknown, key: string): unknown {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    return (value as Record<string, unknown>)[key];
  }
}
