// Mock fixture modeled from `@notionhq/client` v5.21.0 generated response types.
// Version reference: the SDK types in `api-endpoints/common.d.ts` include
// backwards-compatibility notes for API versions prior to `2026-03-11`.
// This fixture targets the full page response shape exposed by that SDK build.

export const ROOT_PAGE_FIXTURE = {
  object: "page",
  id: "01234567-89ab-cdef-0123-456789abcdef",
  created_time: "2026-05-13T07:00:00.000Z",
  last_edited_time: "2026-05-13T07:00:00.000Z",
  in_trash: false,
  archived: false,
  is_archived: false,
  is_locked: false,
  url: "https://www.notion.so/My-Page-0123456789abcdef0123456789abcdef",
  public_url: null,
  parent: {
    type: "workspace",
    workspace: true,
  },
  properties: {
    Name: {
      id: "title",
      type: "title",
      title: [
        {
          type: "text",
          plain_text: "Root Page",
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
            content: "Root Page",
            link: null,
          },
        },
      ],
    },
    Status: {
      id: "status",
      type: "status",
      status: {
        id: "todo",
        name: "Todo",
        color: "gray",
      },
    },
    Notes: {
      id: "notes",
      type: "rich_text",
      rich_text: [
        {
          type: "text",
          plain_text: "Root page notes",
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
            content: "Root page notes",
            link: null,
          },
        },
      ],
    },
    Tags: {
      id: "tags",
      type: "multi_select",
      multi_select: [
        {
          id: "cli",
          name: "CLI",
          color: "green",
        },
        {
          id: "snapshot",
          name: "Snapshot",
          color: "blue",
        },
      ],
    },
    Assignee: {
      id: "assignee",
      type: "people",
      people: [
        {
          object: "user",
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        },
      ],
    },
    Estimate: {
      id: "estimate",
      type: "number",
      number: 5,
    },
    Link: {
      id: "link",
      type: "url",
      url: "https://example.com/root-page",
    },
    Done: {
      id: "done",
      type: "checkbox",
      checkbox: false,
    },
    Due: {
      id: "due",
      type: "date",
      date: {
        start: "2026-05-20",
        end: null,
        time_zone: null,
      },
    },
    Email: {
      id: "email",
      type: "email",
      email: "root@example.com",
    },
    Phone: {
      id: "phone",
      type: "phone_number",
      phone_number: "555-0111",
    },
  },
  icon: {
    type: "emoji",
    emoji: "📘",
  },
  cover: {
    type: "external",
    external: {
      url: "https://example.com/root-cover.png",
    },
  },
  created_by: {
    object: "user",
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  },
  last_edited_by: {
    object: "user",
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  },
} as const;
