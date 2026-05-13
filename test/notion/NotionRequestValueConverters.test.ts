import { describe, expect, it } from "bun:test";
import { toRequestRichText } from "../../src/notion/NotionRequestValueConverters.js";

describe("NotionRequestValueConverters", () => {
  const options = {
    toColor: (value: unknown) => (typeof value === "string" ? value : "default"),
    isTextContentUsable: (content: string) => content.length > 0,
    isEquationExpressionUsable: (expression: string) => expression.length > 0,
  };

  it("falls back to plain text content and href links", () => {
    expect(
      toRequestRichText(
        [
          {
            type: "text",
            plain_text: "Fallback text",
            href: "https://example.com/fallback",
            text: {
              content: "",
              link: null,
            },
            annotations: {
              bold: true,
              color: "red",
            },
          },
        ],
        options,
      ),
    ).toEqual([
      {
        type: "text",
        text: {
          content: "Fallback text",
          link: {
            url: "https://example.com/fallback",
          },
        },
        annotations: {
          bold: true,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          color: "red",
        },
      },
    ]);
  });

  it("keeps equations only when the expression is usable", () => {
    expect(
      toRequestRichText(
        [
          {
            type: "equation",
            plain_text: "E=mc^2",
            equation: {
              expression: "E=mc^2",
            },
            annotations: {},
          },
          {
            type: "equation",
            plain_text: "Plain fallback",
            equation: {
              expression: "",
            },
            annotations: {},
          },
        ],
        options,
      ),
    ).toEqual([
      {
        type: "equation",
        equation: {
          expression: "E=mc^2",
        },
        annotations: {
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          color: "default",
        },
      },
      {
        type: "text",
        text: {
          content: "Plain fallback",
          link: null,
        },
        annotations: {
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          color: "default",
        },
      },
    ]);
  });

  it("compacts adjacent text segments so request rich text stays within Notion's item limit", () => {
    const input = Array.from({ length: 167 }, (_, index) => ({
      type: "text",
      plain_text: `s${index}`,
      href: null,
      text: {
        content: `s${index}`,
        link: null,
      },
      annotations: {
        bold: false,
        italic: false,
        strikethrough: false,
        underline: false,
        code: false,
        color: "default",
      },
    }));

    const result = toRequestRichText(input, options);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: "text",
      text: {
        content: input.map((segment) => segment.text.content).join(""),
        link: null,
      },
      annotations: {
        bold: false,
        italic: false,
        strikethrough: false,
        underline: false,
        code: false,
        color: "default",
      },
    });
  });
});
