import {
  isFullPage,
  type Client,
  type DataSourceObjectResponse,
  type DatabaseObjectResponse,
  type PageObjectResponse,
} from "@notionhq/client";
import type { NotionDatabaseReader } from "./NotionDatabaseReader.js";

export class NotionDatabaseFetcher implements NotionDatabaseReader {
  public constructor(private readonly client: Client) {}

  public async fetchDatabase(databaseId: string): Promise<DatabaseObjectResponse> {
    const response = await this.client.databases.retrieve({ database_id: databaseId });

    if (response.object !== "database" || !("title" in response)) {
      throw new Error(`Expected a full Notion database response for ${databaseId}`);
    }

    return response;
  }

  public async fetchDataSource(dataSourceId: string): Promise<DataSourceObjectResponse> {
    const response = await this.client.dataSources.retrieve({ data_source_id: dataSourceId });

    if (response.object !== "data_source" || !("title" in response)) {
      throw new Error(`Expected a full Notion data source response for ${dataSourceId}`);
    }

    return response;
  }

  public async queryRows(dataSourceId: string): Promise<readonly PageObjectResponse[]> {
    const rows: PageObjectResponse[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.client.dataSources.query(
        cursor
          ? {
              data_source_id: dataSourceId,
              result_type: "page",
              start_cursor: cursor,
            }
          : {
              data_source_id: dataSourceId,
              result_type: "page",
            },
      );

      for (const result of response.results) {
        if (isFullPage(result)) {
          rows.push(result);
        }
      }

      cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
    } while (cursor);

    return rows;
  }
}
