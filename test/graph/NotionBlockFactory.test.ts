import { describe, expect, it } from "bun:test";
import { NotionBlockFactory } from "../../src/graph/NotionBlockFactory.js";
import {
  ROOT_PAGE_BLOCKS_FIXTURE,
  TOGGLE_CHILD_BLOCKS_FIXTURE,
} from "../fixtures/notion/blocks.fixture.js";
import { CHILD_PAGE_BLOCK_FIXTURE } from "../fixtures/notion/childPage.fixture.js";
import { CHILD_DATABASE_BLOCK_FIXTURE } from "../fixtures/notion/database.fixture.js";
import {
  BOOKMARK_BLOCK_FIXTURE,
  CALLOUT_BLOCK_FIXTURE,
  CODE_BLOCK_FIXTURE,
  TABLE_BLOCK_FIXTURE,
  TABLE_ROW_BLOCK_FIXTURE,
} from "../fixtures/notion/coverageBlocks.fixture.js";
import { IMAGE_BLOCK_FIXTURE } from "../fixtures/notion/fileBlocks.fixture.js";

describe("NotionBlockFactory", () => {
  it("builds a canonical notion.block object for a paragraph block", () => {
    const canonical = NotionBlockFactory.createCanonicalBlock(ROOT_PAGE_BLOCKS_FIXTURE[0], null);

    expect(canonical.object_type).toBe("notion.block");
    expect(canonical.source.id).toBe("11111111-1111-1111-1111-111111111111");
    expect(canonical.canonical.block_type).toBe("paragraph");
    expect(canonical.canonical.payload).toEqual({
      color: "default",
      rich_text: [
        {
          annotations: {
            bold: false,
            code: false,
            color: "default",
            italic: false,
            strikethrough: false,
            underline: false,
          },
          href: null,
          plain_text: "Intro paragraph",
          text: {
            content: "Intro paragraph",
            link: null,
          },
          type: "text",
        },
      ],
    });
    expect(canonical.canonical.children_ref).toBeNull();
  });

  it("builds a canonical notion.block object for a nested to_do block", () => {
    const canonical = NotionBlockFactory.createCanonicalBlock(
      TOGGLE_CHILD_BLOCKS_FIXTURE[0],
      null,
    );

    expect(canonical.canonical.block_type).toBe("to_do");
    expect(canonical.canonical.payload).toEqual({
      checked: true,
      color: "default",
      rich_text: [
        {
          annotations: {
            bold: false,
            code: false,
            color: "default",
            italic: false,
            strikethrough: false,
            underline: false,
          },
          href: null,
          plain_text: "Nested task",
          text: {
            content: "Nested task",
            link: null,
          },
          type: "text",
        },
      ],
    });
  });

  it("preserves toggle heading state for headings with children", () => {
    const canonical = NotionBlockFactory.createCanonicalBlock(
      {
        object: "block",
        id: "heading-toggle-1",
        type: "heading_2",
        heading_2: {
          rich_text: [
            {
              type: "text",
              plain_text: "Toggle heading",
              href: null,
              text: {
                content: "Toggle heading",
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
      {
        toString: () =>
          "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      } as never,
    );

    expect(canonical.canonical.payload).toEqual({
      rich_text: [
        {
          annotations: {
            bold: false,
            code: false,
            color: "default",
            italic: false,
            strikethrough: false,
            underline: false,
          },
          href: null,
          plain_text: "Toggle heading",
          text: {
            content: "Toggle heading",
            link: null,
          },
          type: "text",
        },
      ],
      color: "default",
      is_toggleable: true,
    });
    expect(canonical.canonical.children_ref).toBe(
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
  });

  it("builds a notion.children object preserving child order", () => {
    const children = NotionBlockFactory.createChildrenObject([
      {
        source_id: "11111111-1111-1111-1111-111111111111",
        ref: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      {
        source_id: "22222222-2222-2222-2222-222222222222",
        ref: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
    ]);

    expect(children.object_type).toBe("notion.children");
    expect(children.children[0]?.source_id).toBe("11111111-1111-1111-1111-111111111111");
    expect(children.children[1]?.source_id).toBe("22222222-2222-2222-2222-222222222222");
    expect(children.content_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("builds a canonical notion.block object for an image block", () => {
    const canonical = NotionBlockFactory.createCanonicalBlock(
      IMAGE_BLOCK_FIXTURE,
      null,
      "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    );

    expect(canonical.canonical.block_type).toBe("image");
    expect(canonical.canonical.payload).toEqual({
      caption: [],
      file_ref: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    });
  });

  it("builds a canonical notion.block object for a child page block", () => {
    const canonical = NotionBlockFactory.createCanonicalBlock(
      CHILD_PAGE_BLOCK_FIXTURE,
      null,
      null,
      "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    );

    expect(canonical.canonical.block_type).toBe("child_page");
    expect(canonical.canonical.payload).toEqual({
      page_ref: "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      title: "Nested Child Page",
    });
  });

  it("builds a canonical notion.block object for a child database block", () => {
    const canonical = NotionBlockFactory.createCanonicalBlock(
      CHILD_DATABASE_BLOCK_FIXTURE,
      null,
      null,
      null,
      "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    );

    expect(canonical.canonical.block_type).toBe("child_database");
    expect(canonical.canonical.payload).toEqual({
      database_ref: "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      title: "Tasks Database",
    });
  });

  it("builds a canonical notion.block object for a callout block", () => {
    const canonical = NotionBlockFactory.createCanonicalBlock(CALLOUT_BLOCK_FIXTURE, null);

    expect(canonical.canonical.block_type).toBe("callout");
    expect(canonical.canonical.payload).toEqual({
      color: "yellow_background",
      icon: {
        emoji: "⚠️",
        type: "emoji",
      },
      rich_text: [
        {
          annotations: {
            bold: false,
            code: false,
            color: "default",
            italic: false,
            strikethrough: false,
            underline: false,
          },
          href: null,
          plain_text: "Callout text",
          text: {
            content: "Callout text",
            link: null,
          },
          type: "text",
        },
      ],
    });
  });

  it("builds a canonical notion.block object for a code block", () => {
    const canonical = NotionBlockFactory.createCanonicalBlock(CODE_BLOCK_FIXTURE, null);

    expect(canonical.canonical.block_type).toBe("code");
    expect(canonical.canonical.payload).toEqual({
      caption: [],
      language: "javascript",
      rich_text: [
        {
          annotations: {
            bold: false,
            code: false,
            color: "default",
            italic: false,
            strikethrough: false,
            underline: false,
          },
          href: null,
          plain_text: "console.log('hi')",
          text: {
            content: "console.log('hi')",
            link: null,
          },
          type: "text",
        },
      ],
    });
  });

  it("builds a canonical notion.block object for a bookmark block", () => {
    const canonical = NotionBlockFactory.createCanonicalBlock(BOOKMARK_BLOCK_FIXTURE, null);

    expect(canonical.canonical.block_type).toBe("bookmark");
    expect(canonical.canonical.payload).toEqual({
      caption: [],
      url: "https://example.com/docs",
    });
  });

  it("builds a canonical notion.block object for a table block", () => {
    const canonical = NotionBlockFactory.createCanonicalBlock(
      TABLE_BLOCK_FIXTURE,
      {
        toString: () =>
          "sha256:9999999999999999999999999999999999999999999999999999999999999999",
      } as never,
    );

    expect(canonical.canonical.block_type).toBe("table");
    expect(canonical.canonical.payload).toEqual({
      has_column_header: true,
      has_row_header: false,
      table_width: 2,
    });
    expect(canonical.canonical.children_ref).toBe(
      "sha256:9999999999999999999999999999999999999999999999999999999999999999",
    );
  });

  it("builds a canonical notion.block object for a table row block", () => {
    const canonical = NotionBlockFactory.createCanonicalBlock(TABLE_ROW_BLOCK_FIXTURE, null);

    expect(canonical.canonical.block_type).toBe("table_row");
    expect(canonical.canonical.payload).toEqual({
      cells: [
        [
          {
            annotations: {
              bold: false,
              code: false,
              color: "default",
              italic: false,
              strikethrough: false,
              underline: false,
            },
            href: null,
            plain_text: "Header",
            text: {
              content: "Header",
              link: null,
            },
            type: "text",
          },
        ],
        [
          {
            annotations: {
              bold: false,
              code: false,
              color: "default",
              italic: false,
              strikethrough: false,
              underline: false,
            },
            href: null,
            plain_text: "Value",
            text: {
              content: "Value",
              link: null,
            },
            type: "text",
          },
        ],
      ],
    });
  });
});
