import type { CanonicalRichText } from "../graph/NotionRichText.js";
import {
  comparableRestorablePropertyValue,
  isRestorablePropertyType,
  normalizeRestorablePropertyValue,
  requestRestorablePropertyValue,
} from "./NotionPropertyValueRegistry.js";
import {
  normalizeComparableNotionFiles,
  normalizeNotionFiles,
  toNotionFileRequestList,
} from "./NotionFilePropertyValueHelpers.js";
import {
  comparableNormalizedCover,
  comparableNormalizedIcon,
  normalizeCoverValue,
  normalizeIconValue,
} from "./NotionPageMediaValueHelpers.js";
import { toRequestRichText, type RequestRichText } from "./NotionRequestValueConverters.js";

export interface CanonicalPagePropertyValue {
  type: string;
  value: unknown;
}

type PropertyRichTextRequest = RequestRichText<string>;

export class NotionPagePropertyCodec {
  public static normalizeProperties(
    value: unknown,
    fileRefsByProperty: Record<string, (string | null)[]> = {},
  ): Record<string, CanonicalPagePropertyValue> {
    if (!value || typeof value !== "object") {
      return {};
    }

    const normalized: Record<string, CanonicalPagePropertyValue> = {};

    for (const [propertyName, propertyValue] of Object.entries(value as Record<string, unknown>)) {
      if (!propertyValue || typeof propertyValue !== "object") {
        continue;
      }

      const type = NotionPagePropertyCodec.pickString(propertyValue, "type");

      if (!type) {
        continue;
      }

      normalized[propertyName] = {
        type,
        value: NotionPagePropertyCodec.normalizePropertyValue(
          type,
          (propertyValue as Record<string, unknown>)[type],
          fileRefsByProperty[propertyName] ?? [],
        ),
      };
    }

    return normalized;
  }

  public static propertiesForCreate(input: {
    title: CanonicalRichText[];
    properties: Record<string, unknown>;
  }): Record<string, unknown> {
    const properties: Record<string, unknown> = {};
    let hasTitleProperty = false;

    for (const [name, propertyValue] of Object.entries(input.properties)) {
      if (!propertyValue || typeof propertyValue !== "object") {
        continue;
      }

      const property = propertyValue as CanonicalPagePropertyValue;

      if (property.type === "title") {
        hasTitleProperty = true;
      }

      const requestProperty = requestRestorablePropertyValue(property.type, property.value, {
        toFiles: (value) => NotionPagePropertyCodec.toFiles(value),
        toRichText: (value) => NotionPagePropertyCodec.toRichText(value),
      });

      if (requestProperty) {
        properties[name] = requestProperty;
      }
    }

    if (!hasTitleProperty) {
      properties.title = {
        title: NotionPagePropertyCodec.toRichText(input.title),
      };
    }

    return properties;
  }

  public static comparableExpectedProperties(
    properties: Record<string, unknown>,
  ): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};

    for (const [name, propertyValue] of Object.entries(properties)) {
      if (!propertyValue || typeof propertyValue !== "object") {
        continue;
      }

      const property = propertyValue as CanonicalPagePropertyValue;

      if (!isRestorablePropertyType(property.type)) {
        continue;
      }

      normalized[name] = comparableRestorablePropertyValue(property.type, property.value, {
        normalizeComparableFiles: (value) => NotionPagePropertyCodec.normalizeComparableFiles(value),
      });
    }

    return normalized;
  }

  public static comparableActualProperties(
    page: Record<string, unknown>,
    expectedProperties: Record<string, unknown>,
  ): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};
    const properties =
      page.properties && typeof page.properties === "object"
        ? (page.properties as Record<string, unknown>)
        : {};

    for (const [name, propertyValue] of Object.entries(expectedProperties)) {
      if (!propertyValue || typeof propertyValue !== "object") {
        continue;
      }

      const expected = propertyValue as CanonicalPagePropertyValue;

      if (!isRestorablePropertyType(expected.type)) {
        continue;
      }

      const actualProperty =
        properties[name] && typeof properties[name] === "object"
          ? (properties[name] as Record<string, unknown>)
          : expected.type === "title"
            ? NotionPagePropertyCodec.findTitleProperty(properties)
            : {};

      normalized[name] = comparableRestorablePropertyValue(expected.type, actualProperty[expected.type], {
        normalizeComparableFiles: (value) => NotionPagePropertyCodec.normalizeComparableFiles(value),
      });
    }

    return normalized;
  }

  public static normalizeIcon(value: unknown, fileRef: string | null = null): Record<string, unknown> | null {
    return normalizeIconValue(value, fileRef, (input) => NotionPagePropertyCodec.normalizeUnknownValue(input));
  }

  public static normalizeCover(value: unknown, fileRef: string | null = null): Record<string, unknown> | null {
    return normalizeCoverValue(value, fileRef, (input) => NotionPagePropertyCodec.normalizeUnknownValue(input));
  }

  public static restorableIcon(value: unknown): Record<string, unknown> | null {
    const normalized = NotionPagePropertyCodec.normalizeIcon(value);

    if (!normalized) {
      return null;
    }

    return normalized.type === "emoji" || normalized.type === "external" ? normalized : null;
  }

  public static restorableCover(value: unknown): Record<string, unknown> | null {
    const normalized = NotionPagePropertyCodec.normalizeCover(value);

    if (!normalized) {
      return null;
    }

    return normalized.type === "external" ? normalized : null;
  }

  public static comparableIcon(value: unknown): Record<string, unknown> | null {
    const normalized = NotionPagePropertyCodec.normalizeIcon(value);
    return comparableNormalizedIcon(normalized);
  }

  public static comparableCover(value: unknown): Record<string, unknown> | null {
    const normalized = NotionPagePropertyCodec.normalizeCover(value);
    return comparableNormalizedCover(normalized);
  }

  private static normalizePropertyValue(
    type: string,
    value: unknown,
    fileRefs: (string | null)[] = [],
  ): unknown {
    const normalizedValue = normalizeRestorablePropertyValue(type, value, {
      normalizeFiles: (input) => NotionPagePropertyCodec.normalizeFiles(input, fileRefs),
    });

    return normalizedValue ?? NotionPagePropertyCodec.normalizeUnknownValue(value);
  }

  private static normalizeUnknownValue(value: unknown): unknown {
    if (value === undefined) {
      return null;
    }

    if (NotionPagePropertyCodec.isPrimitiveValue(value)) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => NotionPagePropertyCodec.normalizeUnknownValue(item));
    }

    if (typeof value === "object") {
      return NotionPagePropertyCodec.normalizeUnknownObject(value as Record<string, unknown>);
    }

    if (typeof value === "bigint" || typeof value === "symbol") {
      return value.toString();
    }

    if (typeof value === "function") {
      return Function.prototype.toString.call(value);
    }

    return "";
  }

  private static isPrimitiveValue(
    value: unknown,
  ): value is null | string | number | boolean {
    return (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    );
  }

  private static normalizeUnknownObject(value: Record<string, unknown>): Record<string, unknown> {
    const normalizedObject: Record<string, unknown> = {};
    const entries = Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));

    for (const [key, entryValue] of entries) {
      normalizedObject[key] = NotionPagePropertyCodec.normalizeUnknownValue(entryValue);
    }

    return normalizedObject;
  }

  private static normalizeFiles(
    value: unknown,
    fileRefs: (string | null)[],
  ): Record<string, unknown>[] {
    return normalizeNotionFiles(value, fileRefs, (input) => NotionPagePropertyCodec.normalizeUnknownValue(input));
  }

  private static normalizeComparableFiles(value: unknown): Record<string, unknown>[] {
    return normalizeComparableNotionFiles(value);
  }

  private static toFiles(value: unknown): Record<string, unknown>[] {
    return toNotionFileRequestList(value);
  }

  private static toRichText(value: unknown): PropertyRichTextRequest[] {
    return toRequestRichText(value, {
      toColor: (color) => (typeof color === "string" && color.length > 0 ? color : "default"),
      isTextContentUsable: (content) => content.length > 0,
      isEquationExpressionUsable: (expression) => expression.length > 0,
    });
  }

  private static findTitleProperty(properties: Record<string, unknown>): Record<string, unknown> {
    for (const propertyValue of Object.values(properties)) {
      if (!propertyValue || typeof propertyValue !== "object") {
        continue;
      }

      if ((propertyValue as Record<string, unknown>).type === "title") {
        return propertyValue as Record<string, unknown>;
      }
    }

    return {};
  }

  private static pickString(value: unknown, key: string): string | null {
    if (!value || typeof value !== "object" || typeof (value as Record<string, unknown>)[key] !== "string") {
      return null;
    }

    return (value as Record<string, unknown>)[key] as string;
  }
}
