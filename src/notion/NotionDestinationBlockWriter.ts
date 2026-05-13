import { isFullBlock, type Client } from "@notionhq/client";
import type { AppendBlockInput, DestinationBlockWriter } from "./DestinationBlockWriter.js";

export class NotionDestinationBlockWriter implements DestinationBlockWriter {
  public constructor(private readonly client: Client) {}

  public async appendBlock(input: AppendBlockInput): Promise<string> {
    const response = await this.client.blocks.children.append({
      block_id: input.parentId,
      children: [input.block],
    });

    const block = response.results[0];

    if (!block || !isFullBlock(block)) {
      throw new Error(`Expected a full Notion block response when appending under ${input.parentId}`);
    }

    return block.id;
  }
}
