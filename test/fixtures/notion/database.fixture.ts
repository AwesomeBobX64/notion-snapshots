// Mock fixtures modeled from `@notionhq/client` v5.21.0 generated database and
// data source response types. Version reference: the SDK types in
// `api-endpoints/databases.d.ts` and `api-endpoints/data-sources.d.ts` reflect
// the post-data-source query model and include backwards-compatibility notes for
// API versions prior to `2026-03-11`.

const USER_REF = {
  object: "user",
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
} as const;

export const CHILD_DATABASE_BLOCK_FIXTURE = {
  object: "block",
  id: "99999999-9999-9999-9999-999999999999",
  parent: {
    type: "page_id",
    page_id: "01234567-89ab-cdef-0123-456789abcdef",
  },
  type: "child_database",
  child_database: {
    title: "Tasks Database",
  },
  created_time: "2026-05-13T07:00:00.000Z",
  last_edited_time: "2026-05-13T07:00:00.000Z",
  created_by: USER_REF,
  last_edited_by: USER_REF,
  has_children: false,
  in_trash: false,
  archived: false,
} as const;

export const DATABASE_FIXTURE = {
  object: "database",
  id: "99999999-9999-9999-9999-999999999999",
  title: [
    {
      type: "text",
      plain_text: "Tasks Database",
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
        content: "Tasks Database",
        link: null,
      },
    },
  ],
  description: [
    {
      type: "text",
      plain_text: "Imported tasks database",
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
        content: "Imported tasks database",
        link: null,
      },
    },
  ],
  parent: {
    type: "page_id",
    page_id: "01234567-89ab-cdef-0123-456789abcdef",
  },
  is_inline: true,
  in_trash: false,
  archived: false,
  is_locked: false,
  created_time: "2026-05-13T07:00:00.000Z",
  last_edited_time: "2026-05-13T07:00:00.000Z",
  data_sources: [
    {
      id: "abababab-abab-abab-abab-abababababab",
      name: "Tasks",
    },
  ],
  icon: null,
  cover: null,
  url: "https://www.notion.so/99999999999999999999999999999999",
  public_url: null,
} as const;

export const DATA_SOURCE_FIXTURE = {
  object: "data_source",
  id: "abababab-abab-abab-abab-abababababab",
  title: DATABASE_FIXTURE.title,
  description: [],
  parent: {
    type: "database_id",
    database_id: "99999999-9999-9999-9999-999999999999",
  },
  database_parent: {
    type: "page_id",
    page_id: "01234567-89ab-cdef-0123-456789abcdef",
  },
  is_inline: true,
  in_trash: false,
  archived: false,
  created_time: "2026-05-13T07:00:00.000Z",
  last_edited_time: "2026-05-13T07:00:00.000Z",
  created_by: USER_REF,
  last_edited_by: USER_REF,
  properties: {
    Name: {
      id: "title",
      name: "Name",
      description: null,
      type: "title",
      title: {},
    },
    Status: {
      id: "status",
      name: "Status",
      description: null,
      type: "status",
      status: {
        options: [
          {
            id: "todo",
            name: "Todo",
            color: "gray",
            description: null,
          },
        ],
        groups: [
          {
            id: "group-1",
            name: "To do",
            color: "gray",
            option_ids: ["todo"],
          },
        ],
      },
    },
    Notes: {
      id: "notes",
      name: "Notes",
      description: null,
      type: "rich_text",
      rich_text: {},
    },
    Tags: {
      id: "tags",
      name: "Tags",
      description: null,
      type: "multi_select",
      multi_select: {
        options: [
          {
            id: "backend",
            name: "Backend",
            color: "blue",
            description: null,
          },
          {
            id: "cli",
            name: "CLI",
            color: "green",
            description: "Command-line work",
          },
        ],
      },
    },
    Assignee: {
      id: "assignee",
      name: "Assignee",
      description: null,
      type: "people",
      people: {},
    },
    Estimate: {
      id: "estimate",
      name: "Estimate",
      description: null,
      type: "number",
      number: {
        format: "number",
      },
    },
    Link: {
      id: "link",
      name: "Link",
      description: null,
      type: "url",
      url: {},
    },
    Done: {
      id: "done",
      name: "Done",
      description: null,
      type: "checkbox",
      checkbox: {},
    },
    Due: {
      id: "due",
      name: "Due",
      description: null,
      type: "date",
      date: {},
    },
    Email: {
      id: "email",
      name: "Email",
      description: null,
      type: "email",
      email: {},
    },
    Phone: {
      id: "phone",
      name: "Phone",
      description: null,
      type: "phone_number",
      phone_number: {},
    },
    Files: {
      id: "files",
      name: "Files",
      description: null,
      type: "files",
      files: {},
    },
    "Created By": {
      id: "created_by",
      name: "Created By",
      description: null,
      type: "created_by",
      created_by: {},
    },
    "Created Time": {
      id: "created_time",
      name: "Created Time",
      description: null,
      type: "created_time",
      created_time: {},
    },
    "Updated By": {
      id: "updated_by",
      name: "Updated By",
      description: null,
      type: "last_edited_by",
      last_edited_by: {},
    },
    "Updated Time": {
      id: "updated_time",
      name: "Updated Time",
      description: null,
      type: "last_edited_time",
      last_edited_time: {},
    },
    Ticket: {
      id: "ticket",
      name: "Ticket",
      description: null,
      type: "unique_id",
      unique_id: {
        prefix: "TASK-",
      },
    },
  },
  icon: null,
  cover: null,
  url: "https://www.notion.so/abababababababababababababababab",
  public_url: null,
} as const;

export const DATABASE_ROW_PAGE_FIXTURE = {
  object: "page",
  id: "cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd",
  created_time: "2026-05-13T07:00:00.000Z",
  last_edited_time: "2026-05-13T07:00:00.000Z",
  in_trash: false,
  archived: false,
  is_archived: false,
  is_locked: false,
  url: "https://www.notion.so/Database-Row-cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd",
  public_url: null,
  parent: {
    type: "data_source_id",
    data_source_id: "abababab-abab-abab-abab-abababababab",
  },
  properties: {
    Name: {
      id: "title",
      type: "title",
      title: [
        {
          type: "text",
          plain_text: "Task Row",
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
            content: "Task Row",
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
          plain_text: "Important task",
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
            content: "Important task",
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
          id: "backend",
          name: "Backend",
          color: "blue",
        },
        {
          id: "cli",
          name: "CLI",
          color: "green",
        },
      ],
    },
    Assignee: {
      id: "assignee",
      type: "people",
      people: [USER_REF],
    },
    Estimate: {
      id: "estimate",
      type: "number",
      number: 3,
    },
    Link: {
      id: "link",
      type: "url",
      url: "https://example.com/task-row",
    },
    Done: {
      id: "done",
      type: "checkbox",
      checkbox: true,
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
      email: "task@example.com",
    },
    Phone: {
      id: "phone",
      type: "phone_number",
      phone_number: "555-0100",
    },
  },
  icon: null,
  cover: null,
  created_by: USER_REF,
  last_edited_by: USER_REF,
} as const;

export const DATABASE_ROW_BLOCKS_FIXTURE = [
  {
    object: "block",
    id: "dededede-dede-dede-dede-dededededede",
    parent: {
      type: "page_id",
      page_id: "cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd",
    },
    type: "paragraph",
    paragraph: {
      rich_text: [
        {
          type: "text",
          plain_text: "Row details",
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
            content: "Row details",
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
