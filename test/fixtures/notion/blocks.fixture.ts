// Mock fixtures modeled from `@notionhq/client` v5.21.0 generated block response types.
// Version reference: the SDK types in `api-endpoints/blocks.d.ts` and
// `api-endpoints/common.d.ts` include backwards-compatibility notes for API
// versions prior to `2026-03-11`. These fixtures target that full-response shape.

const USER_REF = {
  object: "user",
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
} as const;

export const ROOT_PAGE_BLOCKS_FIXTURE = [
  {
    object: "block",
    id: "11111111-1111-1111-1111-111111111111",
    parent: {
      type: "page_id",
      page_id: "01234567-89ab-cdef-0123-456789abcdef",
    },
    type: "paragraph",
    paragraph: {
      rich_text: [
        {
          type: "text",
          plain_text: "Intro paragraph",
          href: null,
          annotations: {
            bold: false,
            italic: false,
            strikethrough: false,
            underline: false,
            code: false,
            color: "default",
          },
          text: {
            content: "Intro paragraph",
            link: null,
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
  },
  {
    object: "block",
    id: "22222222-2222-2222-2222-222222222222",
    parent: {
      type: "page_id",
      page_id: "01234567-89ab-cdef-0123-456789abcdef",
    },
    type: "toggle",
    toggle: {
      rich_text: [
        {
          type: "text",
          plain_text: "Details",
          href: null,
          annotations: {
            bold: false,
            italic: false,
            strikethrough: false,
            underline: false,
            code: false,
            color: "default",
          },
          text: {
            content: "Details",
            link: null,
          },
        },
      ],
      color: "default",
    },
    created_time: "2026-05-13T07:00:00.000Z",
    last_edited_time: "2026-05-13T07:00:00.000Z",
    created_by: USER_REF,
    last_edited_by: USER_REF,
    has_children: true,
    in_trash: false,
    archived: false,
  },
] as const;

export const TOGGLE_CHILD_BLOCKS_FIXTURE = [
  {
    object: "block",
    id: "33333333-3333-3333-3333-333333333333",
    parent: {
      type: "block_id",
      block_id: "22222222-2222-2222-2222-222222222222",
    },
    type: "to_do",
    to_do: {
      rich_text: [
        {
          type: "text",
          plain_text: "Nested task",
          href: null,
          annotations: {
            bold: false,
            italic: false,
            strikethrough: false,
            underline: false,
            code: false,
            color: "default",
          },
          text: {
            content: "Nested task",
            link: null,
          },
        },
      ],
      color: "default",
      checked: true,
    },
    created_time: "2026-05-13T07:00:00.000Z",
    last_edited_time: "2026-05-13T07:00:00.000Z",
    created_by: USER_REF,
    last_edited_by: USER_REF,
    has_children: false,
    in_trash: false,
    archived: false,
  },
] as const;
