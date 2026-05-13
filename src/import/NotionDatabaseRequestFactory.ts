import type {
  CanonicalDatabaseLike,
  CanonicalDatabaseRowLike,
  CanonicalDatabaseSchemaLike,
  LoadedCanonicalDatabase,
  LoadedCanonicalDatabaseRow,
  LoadedCanonicalDatabaseSchema,
} from "../domain/CanonicalNotionDatabase.js";
import type { LoadedChildren } from "../snapshot/SnapshotLoader.js";
import {
  requestRestorablePropertyValue,
} from "../notion/NotionPropertyValueRegistry.js";
import {
  toRequestFiles,
  toRequestRichText,
  type RequestFile,
  type RequestRichText,
} from "../notion/NotionRequestValueConverters.js";
import { requestSchemaProperty } from "../notion/NotionSchemaPropertyRegistry.js";

type DatabaseRichTextRequest = RequestRichText;

export class NotionDatabaseRequestFactory {
  public static titleForDatabase(database: CanonicalDatabaseLike): string {
    const title = database.canonical.title.map((segment) => segment.plain_text).join("").trim();
    return title.length > 0 ? title : "Untitled Database";
  }

  public static descriptionForDatabase(
    database: CanonicalDatabaseLike,
  ): DatabaseRichTextRequest[] {
    return NotionDatabaseRequestFactory.toRichText(database.canonical.description);
  }

  public static propertiesForSchema(schema: CanonicalDatabaseSchemaLike): Record<string, unknown> {
    const properties: Record<string, unknown> = {};

    for (const [name, propertyValue] of Object.entries(schema.canonical.properties)) {
      if (!propertyValue || typeof propertyValue !== "object") {
        continue;
      }

      const property = propertyValue as { type?: string; config?: Record<string, unknown> };

      if (!property.type) {
        continue;
      }

      const requestProperty = requestSchemaProperty(property.type, property);

      if (requestProperty) {
        properties[name] = requestProperty;
      }
    }

    return properties;
  }

  public static propertiesForRow(
    row: CanonicalDatabaseRowLike,
  ): Record<string, unknown> {
    const properties: Record<string, unknown> = {};

    for (const [name, propertyValue] of Object.entries(row.canonical.properties)) {
      if (!propertyValue || typeof propertyValue !== "object") {
        continue;
      }

      const property = propertyValue as { type?: string; value?: unknown };

      if (!property.type) {
        continue;
      }

      const requestProperty = requestRestorablePropertyValue(property.type, property.value, {
        toDateRequest: (value) => {
          if (value === null) {
            return { date: null };
          }

          if (!value || typeof value !== "object") {
            return null;
          }

          const date = value as { start?: unknown; end?: unknown };

          return typeof date.start === "string"
            ? {
                date: {
                  start: date.start,
                  ...(typeof date.end === "string" ? { end: date.end } : {}),
                },
              }
            : null;
        },
        toFiles: (value) => NotionDatabaseRequestFactory.normalizeFiles(value),
        toRichText: (value) => NotionDatabaseRequestFactory.toRichText(value),
      });

      if (requestProperty) {
        properties[name] = requestProperty;
      }
    }

    return properties;
  }

  public static rowSourceIds(rows: LoadedChildren): string[] {
    return rows.children.map((child) => child.source_id);
  }

  private static normalizeFiles(value: unknown): RequestFile[] {
    return toRequestFiles(value);
  }

  private static toRichText(value: unknown): DatabaseRichTextRequest[] {
    return toRequestRichText(value, {
      toColor: (color) => (typeof color === "string" ? color : "default"),
    });
  }
}

export type {
  LoadedCanonicalDatabase,
  LoadedCanonicalDatabaseRow,
  LoadedCanonicalDatabaseSchema,
  LoadedChildren,
};
