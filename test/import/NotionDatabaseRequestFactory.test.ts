import { describe, expect, it } from "bun:test";
import { ContentHash } from "../../src/domain/ContentHash.js";
import { NotionDatabaseFactory } from "../../src/graph/NotionDatabaseFactory.js";
import { NotionDatabaseRequestFactory } from "../../src/import/NotionDatabaseRequestFactory.js";
import {
  DATABASE_FIXTURE,
  DATABASE_ROW_PAGE_FIXTURE,
  DATA_SOURCE_FIXTURE,
} from "../fixtures/notion/database.fixture.js";

describe("NotionDatabaseRequestFactory", () => {
  it("maps database descriptions, schema properties, and row values from canonical records", () => {
    const schemaHash = ContentHash.parse(
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    const rowsHash = ContentHash.parse(
      "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    );
    const pageHash = ContentHash.parse(
      "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    );

    const schema = NotionDatabaseFactory.createDatabaseSchema(DATA_SOURCE_FIXTURE);
    const database = NotionDatabaseFactory.createDatabase(DATABASE_FIXTURE, schemaHash, rowsHash);
    const row = NotionDatabaseFactory.createDatabaseRow(
      DATABASE_ROW_PAGE_FIXTURE,
      DATABASE_FIXTURE.id,
      pageHash,
    );

    expect(NotionDatabaseRequestFactory.descriptionForDatabase(database)).toEqual([
      {
        type: "text",
        text: {
          content: "Imported tasks database",
          link: null,
        },
        annotations: {
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          color: "default",
        },
      },
    ]);

    const schemaProperties = NotionDatabaseRequestFactory.propertiesForSchema(schema);
    expect(schemaProperties.Notes).toEqual({ rich_text: {} });
    expect(schemaProperties.Tags).toEqual({
      multi_select: {
        options: [
          { name: "Backend", color: "blue", description: null },
          { name: "CLI", color: "green", description: "Command-line work" },
        ],
      },
    });
    expect(schemaProperties.Assignee).toEqual({ people: {} });
    expect(schemaProperties.Estimate).toEqual({ number: { format: "number" } });
    expect(schemaProperties.Done).toEqual({ checkbox: {} });
    expect(schemaProperties.Due).toEqual({ date: {} });
    expect(schemaProperties.Email).toEqual({ email: {} });
    expect(schemaProperties.Phone).toEqual({ phone_number: {} });
    expect(schemaProperties.Files).toEqual({ files: {} });
    expect(schemaProperties["Created By"]).toEqual({ created_by: {} });
    expect(schemaProperties["Created Time"]).toEqual({ created_time: {} });
    expect(schemaProperties["Updated By"]).toEqual({ last_edited_by: {} });
    expect(schemaProperties["Updated Time"]).toEqual({ last_edited_time: {} });
    expect(schemaProperties.Ticket).toEqual({ unique_id: { prefix: "TASK-" } });

    const rowProperties = NotionDatabaseRequestFactory.propertiesForRow(row);
    expect(rowProperties.Notes).toEqual({
      rich_text: [
        {
          type: "text",
          text: { content: "Important task", link: null },
          annotations: {
            bold: false,
            italic: false,
            strikethrough: false,
            underline: false,
            code: false,
            color: "default",
          },
        },
      ],
    });
    expect(rowProperties.Tags).toEqual({
      multi_select: [{ name: "Backend" }, { name: "CLI" }],
    });
    expect(rowProperties.Assignee).toEqual({
      people: [
        {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          object: "user",
        },
      ],
    });
    expect(rowProperties.Estimate).toEqual({ number: 3 });
    expect(rowProperties.Link).toEqual({ url: "https://example.com/task-row" });
    expect(rowProperties.Done).toEqual({ checkbox: true });
    expect(rowProperties.Due).toEqual({ date: { start: "2026-05-20" } });
    expect(rowProperties.Email).toEqual({ email: "task@example.com" });
    expect(rowProperties.Phone).toEqual({ phone_number: "555-0100" });
  });

  it("preserves row-specific date request behavior for null and invalid values", () => {
    expect(
      NotionDatabaseRequestFactory.propertiesForRow({
        source: {
          id: "row-1",
          database_id: "db-1",
        },
        canonical: {
          page_ref: "page-1",
          properties: {
            EmptyDate: {
              type: "date",
              value: null,
            },
            InvalidDate: {
              type: "date",
              value: { end: "2026-05-20" },
            },
          },
        },
      }),
    ).toEqual({
      EmptyDate: { date: null },
    });
  });

  it("reuses shared request converters without changing row rich text or file shaping", () => {
    expect(
      NotionDatabaseRequestFactory.propertiesForRow({
        source: {
          id: "row-2",
          database_id: "db-1",
        },
        canonical: {
          page_ref: "page-2",
          properties: {
            Notes: {
              type: "rich_text",
              value: [
                {
                  type: "text",
                  plain_text: "fallback",
                  href: "https://example.com/fallback",
                  text: {
                    content: "",
                    link: null,
                  },
                  annotations: {
                    italic: true,
                  },
                },
              ],
            },
            Files: {
              type: "files",
              value: [
                {
                  type: "external",
                  name: "Spec",
                  external: {
                    url: "https://example.com/spec.pdf",
                  },
                },
                {
                  type: "file_upload",
                  file_upload: {
                    id: "upload-1",
                  },
                },
                {
                  type: "external",
                  external: {},
                },
              ],
            },
          },
        },
      } satisfies Parameters<typeof NotionDatabaseRequestFactory.propertiesForRow>[0]),
    ).toEqual({
      Notes: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "",
              link: {
                url: "https://example.com/fallback",
              },
            },
            annotations: {
              bold: false,
              italic: true,
              strikethrough: false,
              underline: false,
              code: false,
              color: "default",
            },
          },
        ],
      },
      Files: {
        files: [
          {
            type: "external",
            name: "Spec",
            external: {
              url: "https://example.com/spec.pdf",
            },
          },
          {
            type: "file_upload",
            file_upload: {
              id: "upload-1",
            },
          },
        ],
      },
    });
  });
});
