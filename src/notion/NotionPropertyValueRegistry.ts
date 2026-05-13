import { NotionRichText } from "../graph/NotionRichText.js";

export interface NotionPropertyRequestContext {
  toDateRequest?: (value: unknown) => Record<string, unknown> | null;
  toFiles: (value: unknown) => Record<string, unknown>[];
  toRichText: (value: unknown) => unknown;
}

export interface NotionPropertyNormalizeContext {
  normalizeFiles: (value: unknown) => Record<string, unknown>[];
}

export interface NotionComparablePropertyContext {
  normalizeComparableFiles: (value: unknown) => Record<string, unknown>[];
}

interface NotionPropertyValueHandler {
  comparable?: (value: unknown, context: NotionComparablePropertyContext) => unknown;
  normalize?: (value: unknown, context: NotionPropertyNormalizeContext) => unknown;
  toRequest?: (
    value: unknown,
    context: NotionPropertyRequestContext,
  ) => Record<string, unknown> | null;
}

const normalizeNamedOption = (value: unknown): { name: string } | null => {
  if (!value || typeof value !== "object" || typeof (value as { name?: unknown }).name !== "string") {
    return null;
  }

  return {
    name: (value as { name: string }).name,
  };
};

const normalizeNamedOptions = (
  value: unknown,
  options: { sort: boolean },
): { name: string }[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .map((option) => normalizeNamedOption(option))
    .filter((option): option is { name: string } => option !== null);

  return options.sort
    ? normalized.sort((left, right) => left.name.localeCompare(right.name))
    : normalized;
};

const normalizePeople = (
  value: unknown,
  options: { sort: boolean },
): { id: string; object?: "group" | "user" }[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .map((person) => {
      if (!person || typeof person !== "object" || typeof (person as { id?: unknown }).id !== "string") {
        return null;
      }

      const object =
        (person as { object?: unknown }).object === "group"
          ? "group"
          : (person as { object?: unknown }).object === "user"
            ? "user"
            : undefined;

      return {
        id: (person as { id: string }).id,
        ...(object ? { object } : {}),
      };
    })
    .filter((person): person is { id: string; object?: "group" | "user" } => person !== null);

  return options.sort ? normalized.sort((left, right) => left.id.localeCompare(right.id)) : normalized;
};

const normalizeDate = (value: unknown): { start: string; end?: string } | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const date = value as { start?: unknown; end?: unknown };

  if (typeof date.start !== "string") {
    return null;
  }

  return {
    start: date.start,
    ...(typeof date.end === "string" ? { end: date.end } : {}),
  };
};

const handlers: Readonly<Record<string, NotionPropertyValueHandler>> = {
  title: {
    comparable: (value) => NotionRichText.normalizeArray(value),
    normalize: (value) => NotionRichText.normalizeArray(value),
    toRequest: (value, context) => ({ title: context.toRichText(value) }),
  },
  rich_text: {
    comparable: (value) => NotionRichText.normalizeArray(value),
    normalize: (value) => NotionRichText.normalizeArray(value),
    toRequest: (value, context) => ({ rich_text: context.toRichText(value) }),
  },
  status: {
    comparable: (value) => normalizeNamedOption(value),
    normalize: (value) => normalizeNamedOption(value),
    toRequest: (value) => ({ status: normalizeNamedOption(value) }),
  },
  select: {
    comparable: (value) => normalizeNamedOption(value),
    normalize: (value) => normalizeNamedOption(value),
    toRequest: (value) => ({ select: normalizeNamedOption(value) }),
  },
  multi_select: {
    comparable: (value) => normalizeNamedOptions(value, { sort: true }),
    normalize: (value) => normalizeNamedOptions(value, { sort: false }),
    toRequest: (value) => ({ multi_select: normalizeNamedOptions(value, { sort: false }) }),
  },
  number: {
    comparable: (value) => (typeof value === "number" ? value : null),
    normalize: (value) => (typeof value === "number" ? value : null),
    toRequest: (value) => ({ number: typeof value === "number" ? value : null }),
  },
  url: {
    comparable: (value) => (typeof value === "string" ? value : null),
    normalize: (value) => (typeof value === "string" ? value : null),
    toRequest: (value) => ({ url: typeof value === "string" ? value : null }),
  },
  email: {
    comparable: (value) => (typeof value === "string" ? value : null),
    normalize: (value) => (typeof value === "string" ? value : null),
    toRequest: (value) => ({ email: typeof value === "string" ? value : null }),
  },
  phone_number: {
    comparable: (value) => (typeof value === "string" ? value : null),
    normalize: (value) => (typeof value === "string" ? value : null),
    toRequest: (value) => ({ phone_number: typeof value === "string" ? value : null }),
  },
  checkbox: {
    comparable: (value) => value === true,
    normalize: (value) => value === true,
    toRequest: (value) => ({ checkbox: value === true }),
  },
  date: {
    comparable: (value) => normalizeDate(value),
    normalize: (value) => normalizeDate(value),
    toRequest: (value, context) => {
      const request = context.toDateRequest?.(value);
      return request === undefined ? { date: normalizeDate(value) } : request;
    },
  },
  people: {
    comparable: (value) => normalizePeople(value, { sort: true }),
    normalize: (value) => normalizePeople(value, { sort: false }),
    toRequest: (value) => ({ people: normalizePeople(value, { sort: false }) }),
  },
  files: {
    comparable: (value, context) => context.normalizeComparableFiles(value),
    normalize: (value, context) => context.normalizeFiles(value),
    toRequest: (value, context) => ({ files: context.toFiles(value) }),
  },
};

export const RESTORABLE_PROPERTY_TYPES = new Set(Object.keys(handlers));

export function isRestorablePropertyType(type: string): boolean {
  return Object.hasOwn(handlers, type);
}

export function normalizeRestorablePropertyValue(
  type: string,
  value: unknown,
  context: NotionPropertyNormalizeContext,
): unknown {
  return handlers[type]?.normalize?.(value, context);
}

export function comparableRestorablePropertyValue(
  type: string,
  value: unknown,
  context: NotionComparablePropertyContext,
): unknown {
  return handlers[type]?.comparable?.(value, context);
}

export function requestRestorablePropertyValue(
  type: string,
  value: unknown,
  context: NotionPropertyRequestContext,
): Record<string, unknown> | null {
  return handlers[type]?.toRequest?.(value, context) ?? null;
}
