import { describe, expect, it } from "bun:test";
import { NotionBlockFactory } from "../../src/graph/NotionBlockFactory.js";
import { NotionBlockRequestFactory } from "../../src/import/NotionBlockRequestFactory.js";
import {
  CALLOUT_BLOCK_FIXTURE,
  EQUATION_BLOCK_FIXTURE,
  LINKED_PARAGRAPH_BLOCK_FIXTURE,
  TABLE_BLOCK_FIXTURE,
  TABLE_ROW_BLOCK_FIXTURE,
} from "../fixtures/notion/coverageBlocks.fixture.js";
import {
  FILE_BLOCK_FIXTURE,
  IMAGE_BLOCK_FIXTURE,
  PDF_BLOCK_FIXTURE,
} from "../fixtures/notion/fileBlocks.fixture.js";

describe("NotionBlockRequestFactory", () => {
  it("rebuilds rich text links and equations from canonical blocks", () => {
    const linkedParagraph = NotionBlockFactory.createCanonicalBlock(LINKED_PARAGRAPH_BLOCK_FIXTURE, null);
    const equationParagraph = NotionBlockFactory.createCanonicalBlock(EQUATION_BLOCK_FIXTURE, null);

    expect(NotionBlockRequestFactory.fromCanonicalBlock(linkedParagraph)).toEqual({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          {
            type: "text",
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
        ],
        color: "default",
      },
    });

    expect(NotionBlockRequestFactory.fromCanonicalBlock(equationParagraph)).toEqual({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
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
        ],
        color: "default",
      },
    });
  });

  it("preserves callout icons and creates tables with inline row children", () => {
    const callout = NotionBlockFactory.createCanonicalBlock(CALLOUT_BLOCK_FIXTURE, null);
    const table = NotionBlockFactory.createCanonicalBlock(
      TABLE_BLOCK_FIXTURE,
      {
        toString: () =>
          "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      } as never,
    );
    const tableRow = NotionBlockFactory.createCanonicalBlock(TABLE_ROW_BLOCK_FIXTURE, null);

    expect(NotionBlockRequestFactory.fromCanonicalBlock(callout)).toEqual({
      object: "block",
      type: "callout",
      callout: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Callout text",
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
        ],
        color: "yellow_background",
        icon: {
          type: "emoji",
          emoji: "⚠️",
        },
      },
    });

    expect(NotionBlockRequestFactory.fromCanonicalBlock(table, [tableRow])).toEqual({
      object: "block",
      type: "table",
      table: {
        table_width: 2,
        has_column_header: true,
        has_row_header: false,
        children: [
          {
            type: "table_row",
            table_row: {
              cells: [
                [
                  {
                    type: "text",
                    text: {
                      content: "Header",
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
                ],
                [
                  {
                    type: "text",
                    text: {
                      content: "Value",
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
                ],
              ],
            },
          },
        ],
      },
    });
  });

  it("rebuilds toggle headings with is_toggleable when present", () => {
    const toggleHeading = NotionBlockFactory.createCanonicalBlock(
      {
        object: "block",
        id: "heading-toggle-2",
        type: "heading_2",
        heading_2: {
          rich_text: [
            {
              type: "text",
              plain_text: "Expandable heading",
              href: null,
              text: {
                content: "Expandable heading",
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
          ],
          color: "default",
          is_toggleable: true,
        },
      },
      null,
    );

    expect(NotionBlockRequestFactory.fromCanonicalBlock(toggleHeading)).toEqual({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Expandable heading",
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
        ],
        color: "default",
        is_toggleable: true,
      },
    });
  });

  it("rebuilds uploaded file block requests from canonical file blocks", () => {
    const image = NotionBlockFactory.createCanonicalBlock(IMAGE_BLOCK_FIXTURE, null);
    const file = NotionBlockFactory.createCanonicalBlock(FILE_BLOCK_FIXTURE, null);
    const pdf = NotionBlockFactory.createCanonicalBlock(PDF_BLOCK_FIXTURE, null);

    expect(
      NotionBlockRequestFactory.fromCanonicalUploadedFileBlock(
        image,
        "file-upload-image",
      ),
    ).toEqual({
      object: "block",
      type: "image",
      image: {
        type: "file_upload",
        file_upload: {
          id: "file-upload-image",
        },
        caption: [],
      },
    });

    expect(
      NotionBlockRequestFactory.fromCanonicalUploadedFileBlock(
        file,
        "file-upload-file",
        "notes.txt",
      ),
    ).toEqual({
      object: "block",
      type: "file",
      file: {
        type: "file_upload",
        file_upload: {
          id: "file-upload-file",
        },
        caption: [],
        name: "notes.txt",
      },
    });

    expect(
      NotionBlockRequestFactory.fromCanonicalUploadedFileBlock(
        pdf,
        "file-upload-pdf",
      ),
    ).toEqual({
      object: "block",
      type: "pdf",
      pdf: {
        type: "file_upload",
        file_upload: {
          id: "file-upload-pdf",
        },
        caption: [],
      },
    });
  });

  it("keeps block-specific rich text fallback rules", () => {
    expect(
      NotionBlockRequestFactory.fromCanonicalBlock({
        object_type: "notion.block",
        content_hash: "sha256:test-block",
        source: {
          id: "block-1",
        },
        canonical: {
          block_type: "paragraph",
          payload: {
            rich_text: [
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
                  color: "not-a-color",
                },
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
            color: "default",
          },
          children_ref: null,
        },
      } satisfies Parameters<typeof NotionBlockRequestFactory.fromCanonicalBlock>[0]),
    ).toEqual({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
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
        ],
        color: "default",
      },
    });
  });

  it("preserves supported non-emoji callout icon variants", () => {
    const buildCallout = (icon: unknown) =>
      NotionBlockRequestFactory.fromCanonicalBlock({
        object_type: "notion.block",
        content_hash: "sha256:test-callout",
        source: {
          id: "callout-1",
        },
        canonical: {
          block_type: "callout",
          payload: {
            rich_text: [],
            color: "default",
            icon,
          },
          children_ref: null,
        },
      } satisfies Parameters<typeof NotionBlockRequestFactory.fromCanonicalBlock>[0]);

    expect(
      buildCallout({
        type: "external",
        external: {
          url: "https://example.com/icon.png",
        },
      }),
    ).toMatchObject({
      callout: {
        icon: {
          type: "external",
          external: {
            url: "https://example.com/icon.png",
          },
        },
      },
    });

    expect(
      buildCallout({
        type: "file_upload",
        file_upload: {
          id: "upload-icon",
        },
      }),
    ).toMatchObject({
      callout: {
        icon: {
          type: "file_upload",
          file_upload: {
            id: "upload-icon",
          },
        },
      },
    });

    expect(
      buildCallout({
        type: "custom_emoji",
        custom_emoji: {
          id: "custom-emoji-id",
          name: "party parrot",
          url: "https://example.com/custom-emoji.png",
        },
      }),
    ).toMatchObject({
      callout: {
        icon: {
          type: "custom_emoji",
          custom_emoji: {
            id: "custom-emoji-id",
            name: "party parrot",
            url: "https://example.com/custom-emoji.png",
          },
        },
      },
    });
  });
});
