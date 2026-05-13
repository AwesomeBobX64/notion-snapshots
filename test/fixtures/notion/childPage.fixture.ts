// Mock fixtures modeled from `@notionhq/client` v5.21.0 generated page and block response types.
// Version reference: the SDK types in `api-endpoints/blocks.d.ts` and
// `api-endpoints/common.d.ts` include backwards-compatibility notes for API
// versions prior to `2026-03-11`. These fixtures target that full-response shape.

import { ROOT_PAGE_FIXTURE } from "./rootPage.fixture.js";

const USER_REF = {
  object: "user",
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
} as const;

export const CHILD_PAGE_BLOCK_FIXTURE = {
  object: "block",
  id: "77777777-7777-7777-7777-777777777777",
  parent: {
    type: "page_id",
    page_id: "01234567-89ab-cdef-0123-456789abcdef",
  },
  type: "child_page",
  child_page: {
    title: "Nested Child Page",
  },
  created_time: "2026-05-13T07:00:00.000Z",
  last_edited_time: "2026-05-13T07:00:00.000Z",
  created_by: USER_REF,
  last_edited_by: USER_REF,
  has_children: false,
  in_trash: false,
  archived: false,
} as const;

export const CHILD_PAGE_FIXTURE = {
  ...ROOT_PAGE_FIXTURE,
  id: "77777777-7777-7777-7777-777777777777",
  parent: {
    type: "page_id",
    page_id: "01234567-89ab-cdef-0123-456789abcdef",
  },
  properties: {
    Name: {
      id: "title",
      type: "title",
      title: [
        {
          type: "text",
          plain_text: "Nested Child Page",
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
            content: "Nested Child Page",
            link: null,
          },
        },
      ],
    },
  },
  url: "https://www.notion.so/Nested-Child-Page-77777777777777777777777777777777",
} as const;

export const CHILD_PAGE_BLOCKS_FIXTURE = [
  {
    object: "block",
    id: "88888888-8888-8888-8888-888888888888",
    parent: {
      type: "page_id",
      page_id: "77777777-7777-7777-7777-777777777777",
    },
    type: "paragraph",
    paragraph: {
      rich_text: [
        {
          type: "text",
          plain_text: "Nested page paragraph",
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
            content: "Nested page paragraph",
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
] as const;
