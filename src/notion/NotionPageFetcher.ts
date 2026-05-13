import { isFullPage, type Client, type PageObjectResponse } from "@notionhq/client";
import type { NotionPageReader } from "./NotionPageReader.js";

export class NotionPageFetcher implements NotionPageReader {
  public constructor(private readonly client: Client) {}

  public async fetchPage(pageId: string): Promise<PageObjectResponse> {
    const response = await this.client.pages.retrieve({ page_id: pageId });

    if (!isFullPage(response)) {
      throw new Error(`Expected a full Notion page response for ${pageId}`);
    }

    return response;
  }
}
