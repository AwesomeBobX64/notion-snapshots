import type { CanonicalRichText } from "../graph/NotionRichText.js";

export interface CanonicalDatabaseDataSource {
  source_id: string;
  name: string;
  schema_ref: string;
  rows_ref: string;
}

export interface LoadedCanonicalDatabase {
  object_type: "notion.database";
  content_hash: string;
  source: {
    id: string;
  };
  canonical: {
    title: CanonicalRichText[];
    description: CanonicalRichText[];
    schema_ref: string;
    rows_ref: string;
    data_sources?: CanonicalDatabaseDataSource[];
  };
}

export interface LoadedCanonicalDatabaseSchema {
  object_type: "notion.database_schema";
  content_hash: string;
  source: {
    id: string;
  };
  canonical: {
    properties: Record<string, unknown>;
  };
}

export interface LoadedCanonicalDatabaseRow {
  object_type: "notion.database_row";
  content_hash: string;
  source: {
    id: string;
    database_id: string;
  };
  canonical: {
    properties: Record<string, unknown>;
    page_ref: string;
  };
}

export type CanonicalDatabaseLike = Pick<LoadedCanonicalDatabase, "source" | "canonical">;

export type CanonicalDatabaseSchemaLike = Pick<LoadedCanonicalDatabaseSchema, "canonical">;

export type CanonicalDatabaseRowLike = Pick<LoadedCanonicalDatabaseRow, "source" | "canonical">;

export function primaryCanonicalDatabaseDataSource(
  database: CanonicalDatabaseLike,
): CanonicalDatabaseDataSource {
  const dataSources = Array.isArray(database.canonical.data_sources)
    ? database.canonical.data_sources
    : [];

  if (dataSources.length > 0) {
    const primaryDataSource = dataSources[0];

    if (primaryDataSource) {
      return primaryDataSource;
    }
  }

  return {
    source_id: database.source.id,
    name: "Primary",
    schema_ref: database.canonical.schema_ref,
    rows_ref: database.canonical.rows_ref,
  };
}
