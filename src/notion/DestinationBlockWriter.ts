import type { BlockObjectRequest } from "@notionhq/client";

export interface AppendBlockInput {
  parentId: string;
  block: BlockObjectRequest;
}

export interface DestinationBlockWriter {
  appendBlock(input: AppendBlockInput): Promise<string>;
}
