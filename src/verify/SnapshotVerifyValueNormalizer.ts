import {
  asArray,
  asRecord,
  booleanFlag,
  nestedRecord,
  nonEmptyStringValue,
  nullableStringValue,
  stringValue,
} from "./SnapshotVerifyNormalizerPrimitives.js";

interface ComparableRichTextSegment {
  plain_text: string;
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: string;
  };
}

interface ComparableNamedOption {
  name: string;
}

interface ComparablePerson {
  id: string;
  object?: "group" | "user";
}

interface ComparablePropertyOption {
  name: string;
  color?: string;
  description?: string | null;
}

type ComparableIcon =
  | { type: "emoji"; emoji: string }
  | { type: "external"; external: { url: string } }
  | { type: "file_upload"; file_upload: { id: string } }
  | { type: "custom_emoji"; custom_emoji: { id: string; name?: string; url?: string } };

type IconNormalizer = (icon: Record<string, unknown>) => ComparableIcon | null;

const ICON_NORMALIZERS: Record<string, IconNormalizer> = {
  emoji: normalizeEmojiIcon,
  external: normalizeExternalIcon,
  file_upload: normalizeFileUploadIcon,
  custom_emoji: normalizeCustomEmojiIcon,
};

function richTextSegmentPlainText(segment: Record<string, unknown>): string | null {
  const plainText = stringValue(segment.plain_text);

  if (plainText !== undefined) {
    return plainText;
  }

  return stringValue(nestedRecord(segment, "text")?.content) ?? null;
}

function normalizeRichTextSegment(value: unknown): ComparableRichTextSegment | null {
  const segment = asRecord(value);

  if (!segment) {
    return null;
  }

  const plainText = richTextSegmentPlainText(segment);

  if (plainText === null) {
    return null;
  }

  const annotations = nestedRecord(segment, "annotations") ?? {};

  return {
    plain_text: plainText,
    annotations: {
      bold: booleanFlag(annotations.bold),
      italic: booleanFlag(annotations.italic),
      strikethrough: booleanFlag(annotations.strikethrough),
      underline: booleanFlag(annotations.underline),
      code: booleanFlag(annotations.code),
      color: nonEmptyStringValue(annotations.color) ?? "default",
    },
  };
}

function normalizeNamedOption(value: unknown): ComparableNamedOption | null {
  const option = asRecord(value);
  const name = option ? stringValue(option.name) : undefined;
  return name ? { name } : null;
}

function normalizePerson(value: unknown): ComparablePerson | null {
  const person = asRecord(value);
  const id = person ? stringValue(person.id) : undefined;

  if (!id) {
    return null;
  }

  const object = person?.object === "group" ? "group" : person?.object === "user" ? "user" : undefined;

  return {
    id,
    ...(object ? { object } : {}),
  };
}

function normalizePropertyOption(value: unknown): ComparablePropertyOption | null {
  const option = asRecord(value);
  const name = option ? stringValue(option.name) : undefined;

  if (!name) {
    return null;
  }

  const color = option ? stringValue(option.color) : undefined;
  const description = option ? nullableStringValue(option.description) : undefined;

  return {
    name,
    ...(color ? { color } : {}),
    ...(description !== undefined ? { description } : {}),
  };
}

function normalizeEmojiIcon(icon: Record<string, unknown>): ComparableIcon | null {
  const emoji = stringValue(icon.emoji);
  return emoji ? { type: "emoji", emoji } : null;
}

function normalizeExternalIcon(icon: Record<string, unknown>): ComparableIcon | null {
  const external = nestedRecord(icon, "external");
  const url = external ? stringValue(external.url) : undefined;
  return url
    ? {
        type: "external",
        external: { url },
      }
    : null;
}

function normalizeFileUploadIcon(icon: Record<string, unknown>): ComparableIcon | null {
  const fileUpload = nestedRecord(icon, "file_upload");
  const id = fileUpload ? stringValue(fileUpload.id) : undefined;
  return id
    ? {
        type: "file_upload",
        file_upload: { id },
      }
    : null;
}

function normalizeCustomEmojiIcon(icon: Record<string, unknown>): ComparableIcon | null {
  const customEmoji = nestedRecord(icon, "custom_emoji");
  const id = customEmoji ? stringValue(customEmoji.id) : undefined;

  if (!customEmoji || !id) {
    return null;
  }

  const name = stringValue(customEmoji.name);
  const url = stringValue(customEmoji.url);

  return {
    type: "custom_emoji",
    custom_emoji: {
      id,
      ...(name ? { name } : {}),
      ...(url ? { url } : {}),
    },
  };
}

export class SnapshotVerifyValueNormalizer {
  public static richTextPlainText(value: unknown): string {
    return asArray(value)
      .map((segment) => {
        const record = asRecord(segment);
        return record ? richTextSegmentPlainText(record) ?? "" : "";
      })
      .join("")
      .trim();
  }

  public static richTextArray(value: unknown): ComparableRichTextSegment[] {
    return asArray(value)
      .map((segment) => normalizeRichTextSegment(segment))
      .filter((segment): segment is ComparableRichTextSegment => segment !== null);
  }

  public static namedOption(value: unknown): ComparableNamedOption | null {
    return normalizeNamedOption(value);
  }

  public static namedOptions(value: unknown): ComparableNamedOption[] {
    return asArray(value)
      .map((item) => normalizeNamedOption(item))
      .filter((item): item is ComparableNamedOption => item !== null)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  public static people(value: unknown): ComparablePerson[] {
    return asArray(value)
      .map((person) => normalizePerson(person))
      .filter((person): person is ComparablePerson => person !== null)
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  public static propertyConfigOptions(value: unknown): Record<string, unknown> {
    const options = asArray(asRecord(value)?.options)
      .map((option) => normalizePropertyOption(option))
      .filter((option): option is ComparablePropertyOption => option !== null);

    return options.length > 0 ? { options } : {};
  }

  public static numberConfig(value: unknown): Record<string, unknown> {
    const config = asRecord(value);
    const format = config ? stringValue(config.format) : undefined;
    return format ? { format } : {};
  }

  public static uniqueIdConfig(value: unknown): Record<string, unknown> {
    const config = asRecord(value);
    const prefix = config ? nullableStringValue(config.prefix) : undefined;
    return prefix !== undefined ? { prefix: prefix ?? null } : {};
  }

  public static dateValue(value: unknown): { start: string; end?: string } | null {
    const date = asRecord(value);
    const start = date ? stringValue(date.start) : undefined;

    if (!start) {
      return null;
    }

    const end = date ? stringValue(date.end) : undefined;

    return {
      start,
      ...(end ? { end } : {}),
    };
  }

  public static color(value: unknown): string {
    return nonEmptyStringValue(value) ?? "default";
  }

  public static icon(value: unknown): ComparableIcon | null {
    const icon = asRecord(value);
    const type = icon ? stringValue(icon.type) : undefined;
    const normalizer = type ? ICON_NORMALIZERS[type] : undefined;
    return icon && normalizer ? normalizer(icon) : null;
  }
}
