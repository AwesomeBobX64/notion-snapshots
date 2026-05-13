import { describe, expect, it } from "bun:test";
import { ContentHash } from "../../src/domain/ContentHash.js";
import { NotionDatabaseFactory } from "../../src/graph/NotionDatabaseFactory.js";
import {
  DATABASE_FIXTURE,
  DATABASE_ROW_PAGE_FIXTURE,
  DATA_SOURCE_FIXTURE,
} from "../fixtures/notion/database.fixture.js";

describe("NotionDatabaseFactory", () => {
  it("builds canonical notion.database and notion.database_schema objects", () => {
    const schemaHash = ContentHash.parse(
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    const rowsHash = ContentHash.parse(
      "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    );

    const schema = NotionDatabaseFactory.createDatabaseSchema(DATA_SOURCE_FIXTURE);
    const database = NotionDatabaseFactory.createDatabase(DATABASE_FIXTURE, schemaHash, rowsHash);

    expect(schema.object_type).toBe("notion.database_schema");
    expect(schema.canonical.properties).toHaveProperty("Name");
    expect(schema.canonical.properties).toHaveProperty("Status");

    expect(database.object_type).toBe("notion.database");
    expect(database.canonical.schema_ref).toBe(schemaHash.toString());
    expect(database.canonical.rows_ref).toBe(rowsHash.toString());
    expect(database.canonical.title[0]?.plain_text).toBe("Tasks Database");
    expect(database.canonical.data_sources).toEqual([
      {
        source_id: "abababab-abab-abab-abab-abababababab",
        name: "Tasks",
        schema_ref: schemaHash.toString(),
        rows_ref: rowsHash.toString(),
      },
    ]);
  });

  it("builds raw database and raw data source audit records", () => {
    const rawDatabase = NotionDatabaseFactory.createRawDatabase(
      DATABASE_FIXTURE,
      "2026-05-13T07:00:00.000Z",
    );
    const rawDataSource = NotionDatabaseFactory.createRawDataSource(
      DATA_SOURCE_FIXTURE,
      "2026-05-13T07:00:00.000Z",
    );

    expect(rawDatabase.object_type).toBe("raw.notion.database");
    expect(rawDatabase.source.id).toBe("99999999-9999-9999-9999-999999999999");
    expect(rawDataSource.object_type).toBe("raw.notion.data_source");
    expect(rawDataSource.source.id).toBe("abababab-abab-abab-abab-abababababab");
  });

  it("builds a canonical notion.database_row object", () => {
    const pageHash = ContentHash.parse(
      "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    );

    const row = NotionDatabaseFactory.createDatabaseRow(
      DATABASE_ROW_PAGE_FIXTURE,
      "99999999-9999-9999-9999-999999999999",
      pageHash,
    );

    expect(row.object_type).toBe("notion.database_row");
    expect(row.source.database_id).toBe("99999999-9999-9999-9999-999999999999");
    expect(row.canonical.page_ref).toBe(pageHash.toString());
    expect(row.canonical.properties).toHaveProperty("Name");
    expect(row.canonical.properties).toHaveProperty("Status");
  });
});
