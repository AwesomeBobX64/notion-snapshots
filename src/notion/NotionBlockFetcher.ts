import { isFullBlock, type BlockObjectResponse, type Client } from "@notionhq/client";
import type { NotionBlockReader } from "./NotionBlockReader.js";
import type { NotionBlockRetriever } from "./NotionBlockRetriever.js";

export class NotionBlockFetcher implements NotionBlockReader, NotionBlockRetriever {
  public constructor(private readonly client: Client) {}

  public async fetchBlock(blockId: string): Promise<BlockObjectResponse> {
    const response = await this.client.blocks.retrieve({ block_id: blockId });

    if (!isFullBlock(response)) {
      throw new Error(`Expected a full Notion block response for ${blockId}`);
    }

    return response;
  }

  public async fetchBlockChildren(
    blockId: string,
  ): Promise<readonly (BlockObjectResponse | Record<string, unknown>)[]> {
    const results: (BlockObjectResponse | Record<string, unknown>)[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.client.blocks.children.list(
        cursor
          ? {
              block_id: blockId,
              start_cursor: cursor,
            }
          : {
              block_id: blockId,
            },
      );

      results.push(...(response.results as (BlockObjectResponse | Record<string, unknown>)[]));

      cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
    } while (cursor);

    return results;
  }
}
