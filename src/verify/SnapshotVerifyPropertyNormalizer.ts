import { NotionPagePropertyCodec } from "../notion/NotionPagePropertyCodec.js";
import { normalizeActualSchemaProperty } from "../notion/NotionSchemaPropertyRegistry.js";
import { asRecord, asRecordOrEmpty, stringValue } from "./SnapshotVerifyNormalizerPrimitives.js";

interface LoadedCanonicalDatabaseSchemaShape {
  canonical: {
    properties: Record<string, unknown>;
  };
}

export class SnapshotVerifyPropertyNormalizer {
  public static expectedRowProperties(properties: Record<string, unknown>): Record<string, unknown> {
    return NotionPagePropertyCodec.comparableExpectedProperties(properties);
  }

  public static actualRowProperties(
    page: Record<string, unknown>,
    expectedProperties: Record<string, unknown>,
  ): Record<string, unknown> {
    return NotionPagePropertyCodec.comparableActualProperties(page, expectedProperties);
  }

  public static actualSchemaProperties(
    value: unknown,
    schema: LoadedCanonicalDatabaseSchemaShape,
  ): Record<string, unknown> {
    const properties = asRecordOrEmpty(value);
    const normalized: Record<string, unknown> = {};

    for (const [name, propertyValue] of Object.entries(schema.canonical.properties)) {
      const expectedProperty = asRecord(propertyValue);

      if (!expectedProperty) {
        continue;
      }

      const expectedType = stringValue(expectedProperty.type);

      if (!expectedType) {
        continue;
      }

      const normalizedProperty = normalizeActualSchemaProperty(expectedType, asRecordOrEmpty(properties[name]));

      if (normalizedProperty) {
        normalized[name] = normalizedProperty;
      }
    }

    return normalized;
  }
}
