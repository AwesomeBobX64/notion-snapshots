// Mock fixtures modeled from `@notionhq/client` v5.21.0 generated block response types.
// Version reference: the SDK types in `api-endpoints/blocks.d.ts` include
// backwards-compatibility notes for API versions prior to `2026-03-11`.
// These fixtures target the full-response block shapes from that SDK build.

const USER_REF = {
  object: "user",
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
} as const;

const PAGE_PARENT = {
  type: "page_id",
  page_id: "01234567-89ab-cdef-0123-456789abcdef",
} as const;

const DEFAULT_ANNOTATIONS = {
  bold: false,
  italic: false,
  strikethrough: false,
  underline: false,
  code: false,
  color: "default",
} as const;

export const CALLOUT_BLOCK_FIXTURE = {
  object: "block",
  id: "10101010-1010-1010-1010-101010101010",
  parent: PAGE_PARENT,
  type: "callout",
  callout: {
    rich_text: [
      {
        type: "text",
        plain_text: "Callout text",
        href: null,
        annotations: DEFAULT_ANNOTATIONS,
        text: { content: "Callout text", link: null },
      },
    ],
    color: "yellow_background",
    icon: {
      type: "emoji",
      emoji: "⚠️",
    },
  },
  created_time: "2026-05-13T07:00:00.000Z",
  last_edited_time: "2026-05-13T07:00:00.000Z",
  created_by: USER_REF,
  last_edited_by: USER_REF,
  has_children: false,
  in_trash: false,
  archived: false,
} as const;

export const LINKED_PARAGRAPH_BLOCK_FIXTURE = {
  object: "block",
  id: "11112222-3333-4444-5555-666677778888",
  parent: PAGE_PARENT,
  type: "paragraph",
  paragraph: {
    rich_text: [
      {
        type: "text",
        plain_text: "Cursor docs",
        href: "https://cursor.com/docs",
        annotations: DEFAULT_ANNOTATIONS,
        text: {
          content: "Cursor docs",
          link: {
            url: "https://cursor.com/docs",
          },
        },
      },
    ],
    color: "default",
  },
  created_time: "2026-05-13T07:00:00.000Z",
  last_edited_time: "2026-05-13T07:00:00.000Z",
  created_by: USER_REF,
  last_edited_by: USER_REF,
  has_children: false,
  in_trash: false,
  archived: false,
} as const;

export const EQUATION_BLOCK_FIXTURE = {
  object: "block",
  id: "12121212-1212-1212-1212-121212121212",
  parent: PAGE_PARENT,
  type: "paragraph",
  paragraph: {
    rich_text: [
      {
        type: "equation",
        plain_text: "E=mc^2",
        href: null,
        annotations: DEFAULT_ANNOTATIONS,
        equation: {
          expression: "E=mc^2",
        },
      },
    ],
    color: "default",
  },
  created_time: "2026-05-13T07:00:00.000Z",
  last_edited_time: "2026-05-13T07:00:00.000Z",
  created_by: USER_REF,
  last_edited_by: USER_REF,
  has_children: false,
  in_trash: false,
  archived: false,
} as const;

export const CODE_BLOCK_FIXTURE = {
  object: "block",
  id: "20202020-2020-2020-2020-202020202020",
  parent: PAGE_PARENT,
  type: "code",
  code: {
    rich_text: [
      {
        type: "text",
        plain_text: "console.log('hi')",
        href: null,
        annotations: DEFAULT_ANNOTATIONS,
        text: { content: "console.log('hi')", link: null },
      },
    ],
    caption: [],
    language: "javascript",
  },
  created_time: "2026-05-13T07:00:00.000Z",
  last_edited_time: "2026-05-13T07:00:00.000Z",
  created_by: USER_REF,
  last_edited_by: USER_REF,
  has_children: false,
  in_trash: false,
  archived: false,
} as const;

export const BOOKMARK_BLOCK_FIXTURE = {
  object: "block",
  id: "30303030-3030-3030-3030-303030303030",
  parent: PAGE_PARENT,
  type: "bookmark",
  bookmark: {
    url: "https://example.com/docs",
    caption: [],
  },
  created_time: "2026-05-13T07:00:00.000Z",
  last_edited_time: "2026-05-13T07:00:00.000Z",
  created_by: USER_REF,
  last_edited_by: USER_REF,
  has_children: false,
  in_trash: false,
  archived: false,
} as const;

export const TABLE_BLOCK_FIXTURE = {
  object: "block",
  id: "40404040-4040-4040-4040-404040404040",
  parent: PAGE_PARENT,
  type: "table",
  table: {
    has_column_header: true,
    has_row_header: false,
    table_width: 2,
  },
  created_time: "2026-05-13T07:00:00.000Z",
  last_edited_time: "2026-05-13T07:00:00.000Z",
  created_by: USER_REF,
  last_edited_by: USER_REF,
  has_children: true,
  in_trash: false,
  archived: false,
} as const;

export const TABLE_ROW_BLOCK_FIXTURE = {
  object: "block",
  id: "50505050-5050-5050-5050-505050505050",
  parent: {
    type: "block_id",
    block_id: "40404040-4040-4040-4040-404040404040",
  },
  type: "table_row",
  table_row: {
    cells: [
      [
        {
          type: "text",
          plain_text: "Header",
          href: null,
          annotations: DEFAULT_ANNOTATIONS,
          text: { content: "Header", link: null },
        },
      ],
      [
        {
          type: "text",
          plain_text: "Value",
          href: null,
          annotations: DEFAULT_ANNOTATIONS,
          text: { content: "Value", link: null },
        },
      ],
    ],
  },
  created_time: "2026-05-13T07:00:00.000Z",
  last_edited_time: "2026-05-13T07:00:00.000Z",
  created_by: USER_REF,
  last_edited_by: USER_REF,
  has_children: false,
  in_trash: false,
  archived: false,
} as const;

export const UNSUPPORTED_BLOCK_FIXTURE = {
  object: "block",
  id: "60606060-6060-6060-6060-606060606060",
  parent: PAGE_PARENT,
  type: "unsupported",
  unsupported: {},
  created_time: "2026-05-13T07:00:00.000Z",
  last_edited_time: "2026-05-13T07:00:00.000Z",
  created_by: USER_REF,
  last_edited_by: USER_REF,
  has_children: false,
  in_trash: false,
  archived: false,
} as const;
