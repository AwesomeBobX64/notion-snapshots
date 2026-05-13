const BLOCK_PAYLOAD_FAMILY_BY_TYPE = {
  paragraph: "rich_text_color",
  heading_1: "rich_text_color",
  heading_2: "rich_text_color",
  heading_3: "rich_text_color",
  bulleted_list_item: "rich_text_color",
  numbered_list_item: "rich_text_color",
  quote: "rich_text_color",
  toggle: "rich_text_color",
  to_do: "to_do",
  divider: "divider",
  callout: "callout",
  code: "code",
  bookmark: "bookmark",
  image: "file",
  file: "file",
  pdf: "file",
  child_page: "child_reference",
  child_database: "child_reference",
  table: "table",
  table_row: "table_row",
} as const;

const CHILD_REFERENCE_KEY_BY_TYPE = {
  child_page: "page_ref",
  child_database: "database_ref",
} as const;

type KnownNotionBlockType = keyof typeof BLOCK_PAYLOAD_FAMILY_BY_TYPE;
type KnownChildReferenceBlockType = keyof typeof CHILD_REFERENCE_KEY_BY_TYPE;

export type NotionBlockPayloadFamily =
  | (typeof BLOCK_PAYLOAD_FAMILY_BY_TYPE)[KnownNotionBlockType]
  | "other";

export function notionBlockPayloadFamily(blockType: string): NotionBlockPayloadFamily {
  return BLOCK_PAYLOAD_FAMILY_BY_TYPE[blockType as KnownNotionBlockType] ?? "other";
}

export function notionChildReferenceKey(
  blockType: string,
): (typeof CHILD_REFERENCE_KEY_BY_TYPE)[KnownChildReferenceBlockType] | null {
  return CHILD_REFERENCE_KEY_BY_TYPE[blockType as KnownChildReferenceBlockType] ?? null;
}

export function isNotionFileBlockType(blockType: string): boolean {
  return notionBlockPayloadFamily(blockType) === "file";
}
