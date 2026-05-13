import type { PageObjectResponse } from "@notionhq/client";

export interface NotionPageReader {
  fetchPage(pageId: string): Promise<PageObjectResponse | Record<string, unknown>>;
}
