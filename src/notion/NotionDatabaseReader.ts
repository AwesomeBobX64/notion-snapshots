import type { DataSourceObjectResponse, DatabaseObjectResponse, PageObjectResponse } from "@notionhq/client";

export interface NotionDatabaseReader {
  fetchDatabase(databaseId: string): Promise<DatabaseObjectResponse | Record<string, unknown>>;
  fetchDataSource(dataSourceId: string): Promise<DataSourceObjectResponse | Record<string, unknown>>;
  queryRows(dataSourceId: string): Promise<readonly (PageObjectResponse | Record<string, unknown>)[]>;
}
