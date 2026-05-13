import type {
  DataSourceObjectResponse,
  DatabaseObjectResponse,
  PageObjectResponse,
  PartialPageObjectResponse,
} from "@notionhq/client";
import type { ContentHash } from "../domain/ContentHash.js";
import type { CanonicalDatabaseDataSource } from "../domain/CanonicalNotionDatabase.js";
import { Sha256 } from "../cas/Sha256.js";
import { NotionRichText } from "./NotionRichText.js";

export interface CanonicalNotionDatabaseRecord {
  object_type: "notion.database";
  schema_version: 1;
  content_hash: string;
  source: {
    id: string;
  };
  canonical: {
    title: ReturnType<typeof NotionRichText.normalizeArray>;
    description: ReturnType<typeof NotionRichText.normalizeArray>;
    schema_ref: string;
    rows_ref: string;
    data_sources: CanonicalDatabaseDataSource[];
  };
}

export interface CanonicalNotionDatabaseSchemaRecord {
  object_type: "notion.database_schema";
  schema_version: 1;
  content_hash: string;
  source: {
    id: string;
  };
  canonical: {
    properties: Record<string, unknown>;
  };
}

export interface CanonicalNotionDatabaseRowRecord {
  object_type: "notion.database_row";
  schema_version: 1;
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

export interface RawNotionDatabaseRecord {
  object_type: "raw.notion.database";
  schema_version: 1;
  content_hash: string;
  source: {
    id: string;
    fetched_at: string;
  };
  payload: DatabaseObjectResponse | Record<string, unknown>;
}

export interface RawNotionDataSourceRecord {
  object_type: "raw.notion.data_source";
  schema_version: 1;
  content_hash: string;
  source: {
    id: string;
    fetched_at: string;
  };
  payload: DataSourceObjectResponse | Record<string, unknown>;
}

type NotionPageLike = PageObjectResponse | PartialPageObjectResponse | Record<string, unknown>;

export class NotionDatabaseFactory {
  public static createRawDatabase(
    database: DatabaseObjectResponse | Record<string, unknown>,
    fetchedAt: string,
  ): RawNotionDatabaseRecord {
    const payload: Omit<RawNotionDatabaseRecord, "content_hash"> = {
      object_type: "raw.notion.database",
      schema_version: 1,
      source: {
        id: NotionDatabaseFactory.pickString(database, "id", "Notion database is missing an id"),
        fetched_at: fetchedAt,
      },
      payload: database,
    };

    return {
      ...payload,
      content_hash: Sha256.hashCanonicalJson(payload).toString(),
    };
  }

  public static createRawDataSource(
    dataSource: DataSourceObjectResponse | Record<string, unknown>,
    fetchedAt: string,
  ): RawNotionDataSourceRecord {
    const payload: Omit<RawNotionDataSourceRecord, "content_hash"> = {
      object_type: "raw.notion.data_source",
      schema_version: 1,
      source: {
        id: NotionDatabaseFactory.pickString(dataSource, "id", "Notion data source is missing an id"),
        fetched_at: fetchedAt,
      },
      payload: dataSource,
    };

    return {
      ...payload,
      content_hash: Sha256.hashCanonicalJson(payload).toString(),
    };
  }

  public static createDatabase(
    database: DatabaseObjectResponse | Record<string, unknown>,
    schemaRef: ContentHash,
    rowsRef: ContentHash,
    dataSources?: CanonicalDatabaseDataSource[],
  ): CanonicalNotionDatabaseRecord {
    const canonicalDataSources = dataSources ?? [
      {
        source_id: NotionDatabaseFactory.firstDataSourceId(database),
        name: NotionDatabaseFactory.firstDataSourceName(database),
        schema_ref: schemaRef.toString(),
        rows_ref: rowsRef.toString(),
      },
    ];
    const payload: Omit<CanonicalNotionDatabaseRecord, "content_hash"> = {
      object_type: "notion.database",
      schema_version: 1,
      source: {
        id: NotionDatabaseFactory.pickString(database, "id", "Notion database is missing an id"),
      },
      canonical: {
        title: NotionRichText.normalizeArray(NotionDatabaseFactory.pick(database, "title")),
        description: NotionRichText.normalizeArray(NotionDatabaseFactory.pick(database, "description")),
        schema_ref: schemaRef.toString(),
        rows_ref: rowsRef.toString(),
        data_sources: canonicalDataSources.map((dataSource) => structuredClone(dataSource)),
      },
    };

    return {
      ...payload,
      content_hash: Sha256.hashCanonicalJson(payload).toString(),
    };
  }

  public static createDatabaseSchema(
    dataSource: DataSourceObjectResponse | Record<string, unknown>,
  ): CanonicalNotionDatabaseSchemaRecord {
    const payload: Omit<CanonicalNotionDatabaseSchemaRecord, "content_hash"> = {
      object_type: "notion.database_schema",
      schema_version: 1,
      source: {
        id: NotionDatabaseFactory.pickString(dataSource, "id", "Notion data source is missing an id"),
      },
      canonical: {
        properties: NotionDatabaseFactory.normalizeProperties(
          NotionDatabaseFactory.pick(dataSource, "properties"),
        ),
      },
    };

    return {
      ...payload,
      content_hash: Sha256.hashCanonicalJson(payload).toString(),
    };
  }

  public static createDatabaseRow(
    page: NotionPageLike,
    databaseId: string,
    pageRef: ContentHash,
    properties?: Record<string, unknown>,
  ): CanonicalNotionDatabaseRowRecord {
    const payload: Omit<CanonicalNotionDatabaseRowRecord, "content_hash"> = {
      object_type: "notion.database_row",
      schema_version: 1,
      source: {
        id: NotionDatabaseFactory.pickString(page, "id", "Notion database row is missing an id"),
        database_id: databaseId,
      },
      canonical: {
        properties: properties
          ? structuredClone(properties)
          : NotionDatabaseFactory.normalizeRowProperties(NotionDatabaseFactory.pick(page, "properties")),
        page_ref: pageRef.toString(),
      },
    };

    return {
      ...payload,
      content_hash: Sha256.hashCanonicalJson(payload).toString(),
    };
  }

  private static normalizeProperties(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object") {
      return {};
    }

    const properties = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};

    for (const [propertyName, propertyValue] of Object.entries(properties)) {
      if (!propertyValue || typeof propertyValue !== "object") {
        continue;
      }

      const type = NotionDatabaseFactory.pick(propertyValue, "type");
      const typeKey = typeof type === "string" ? type : "";

      normalized[propertyName] = {
        id: NotionDatabaseFactory.pick(propertyValue, "id"),
        name: NotionDatabaseFactory.pick(propertyValue, "name") ?? propertyName,
        type,
        config: NotionDatabaseFactory.pick(propertyValue, typeKey) ?? {},
      };
    }

    return normalized;
  }

  private static normalizeRowProperties(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object") {
      return {};
    }

    const properties = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};

    for (const [propertyName, propertyValue] of Object.entries(properties)) {
      if (!propertyValue || typeof propertyValue !== "object") {
        continue;
      }

      const type = NotionDatabaseFactory.pick(propertyValue, "type");
      const typeKey = typeof type === "string" ? type : "";
      normalized[propertyName] = {
        type,
        value: NotionDatabaseFactory.pick(propertyValue, typeKey) ?? null,
      };
    }

    return normalized;
  }

  private static pick(value: unknown, key: string): unknown {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    return (value as Record<string, unknown>)[key];
  }

  private static pickString(value: unknown, key: string, errorMessage: string): string {
    const extracted = NotionDatabaseFactory.pick(value, key);

    if (typeof extracted !== "string" || extracted.length === 0) {
      throw new Error(errorMessage);
    }

    return extracted;
  }

  private static firstDataSourceId(database: DatabaseObjectResponse | Record<string, unknown>): string {
    const dataSources = NotionDatabaseFactory.pick(database, "data_sources");

    if (!Array.isArray(dataSources) || dataSources.length === 0) {
      throw new Error("Notion database is missing a data source id");
    }

    const firstDataSource: unknown = dataSources[0];
    return NotionDatabaseFactory.pickString(
      firstDataSource,
      "id",
      "Notion database is missing a data source id",
    );
  }

  private static firstDataSourceName(database: DatabaseObjectResponse | Record<string, unknown>): string {
    const dataSources = NotionDatabaseFactory.pick(database, "data_sources");

    if (!Array.isArray(dataSources) || dataSources.length === 0) {
      return "Untitled Data Source";
    }

    const firstDataSource: unknown = dataSources[0];
    const name = NotionDatabaseFactory.pick(firstDataSource, "name");
    return typeof name === "string" && name.length > 0 ? name : "Untitled Data Source";
  }
}
