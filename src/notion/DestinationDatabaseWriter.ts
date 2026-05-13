export interface CreateInlineDatabaseInput {
  parentPageId: string;
  title: string;
  description: Record<string, unknown>[];
  properties: Record<string, unknown>;
}

export interface CreateDatabaseRowInput {
  dataSourceId: string;
  properties: Record<string, unknown>;
}

export interface DestinationDatabaseWriter {
  createInlineDatabase(
    input: CreateInlineDatabaseInput,
  ): Promise<{ databaseId: string; dataSourceId: string }>;

  createRowPage(input: CreateDatabaseRowInput): Promise<string>;
}
