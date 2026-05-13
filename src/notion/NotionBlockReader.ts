import type { BlockObjectResponse } from "@notionhq/client";

export interface NotionBlockReader {
  fetchBlockChildren(blockId: string): Promise<readonly (BlockObjectResponse | Record<string, unknown>)[]>;
}
