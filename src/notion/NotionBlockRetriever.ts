import type { BlockObjectResponse } from "@notionhq/client";

export interface NotionBlockRetriever {
  fetchBlock(blockId: string): Promise<BlockObjectResponse | Record<string, unknown>>;
}
