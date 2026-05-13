import { describe, expect, it } from "bun:test";
import { NotionRichText } from "../../src/graph/NotionRichText.js";
import {
  EQUATION_BLOCK_FIXTURE,
  LINKED_PARAGRAPH_BLOCK_FIXTURE,
} from "../fixtures/notion/coverageBlocks.fixture.js";

describe("NotionRichText", () => {
  it("preserves text link metadata in canonical rich text", () => {
    const normalized = NotionRichText.normalizeArray(
      LINKED_PARAGRAPH_BLOCK_FIXTURE.paragraph.rich_text,
    );

    expect(normalized).toEqual([
      {
        type: "text",
        plain_text: "Cursor docs",
        href: "https://cursor.com/docs",
        text: {
          content: "Cursor docs",
          link: {
            url: "https://cursor.com/docs",
          },
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

  it("preserves equation structure in canonical rich text", () => {
    const normalized = NotionRichText.normalizeArray(EQUATION_BLOCK_FIXTURE.paragraph.rich_text);

    expect(normalized).toEqual([
      {
        type: "equation",
        plain_text: "E=mc^2",
        href: null,
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
    ]);
  });
});
