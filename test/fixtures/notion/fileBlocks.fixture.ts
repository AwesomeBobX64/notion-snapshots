// Mock fixtures modeled from `@notionhq/client` v5.21.0 generated block response types.
// Version reference: the SDK types in `api-endpoints/blocks.d.ts` and
// `api-endpoints/common.d.ts` include backwards-compatibility notes for API
// versions prior to `2026-03-11`. These fixtures target that full-response shape.

const USER_REF = {
  object: "user",
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
} as const;

const PAGE_PARENT = {
  type: "page_id",
  page_id: "01234567-89ab-cdef-0123-456789abcdef",
} as const;

export const IMAGE_BLOCK_FIXTURE = {
  object: "block",
  id: "44444444-4444-4444-4444-444444444444",
  parent: PAGE_PARENT,
  type: "image",
  image: {
    type: "file",
    file: {
      url: "https://files.notion.test/image.png",
      expiry_time: "2026-05-13T08:00:00.000Z",
    },
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

export const FILE_BLOCK_FIXTURE = {
  object: "block",
  id: "55555555-5555-5555-5555-555555555555",
  parent: PAGE_PARENT,
  type: "file",
  file: {
    type: "file",
    file: {
      url: "https://files.notion.test/notes.txt",
      expiry_time: "2026-05-13T08:00:00.000Z",
    },
    caption: [],
    name: "notes.txt",
  },
  created_time: "2026-05-13T07:00:00.000Z",
  last_edited_time: "2026-05-13T07:00:00.000Z",
  created_by: USER_REF,
  last_edited_by: USER_REF,
  has_children: false,
  in_trash: false,
  archived: false,
} as const;

export const PDF_BLOCK_FIXTURE = {
  object: "block",
  id: "66666666-6666-6666-6666-666666666666",
  parent: PAGE_PARENT,
  type: "pdf",
  pdf: {
    type: "file",
    file: {
      url: "https://files.notion.test/spec.pdf",
      expiry_time: "2026-05-13T08:00:00.000Z",
    },
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
