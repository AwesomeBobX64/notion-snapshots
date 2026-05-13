interface CanonicalSchemaProperty {
  config?: Record<string, unknown>;
}

interface SchemaPropertyHandler {
  normalizeActual: (actualProperty: Record<string, unknown>) => Record<string, unknown>;
  toRequest: (property: CanonicalSchemaProperty) => Record<string, unknown>;
}

interface ComparablePropertyOption {
  name: string;
  color?: string;
  description?: string | null;
}

const normalizePropertyConfigOptions = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object") {
    return {};
  }

  const options = Array.isArray((value as Record<string, unknown>).options)
    ? ((value as Record<string, unknown>).options as Record<string, unknown>[])
        .map((option) => {
          if (typeof option.name !== "string") {
            return null;
          }

          return {
            name: option.name,
            ...(typeof option.color === "string" ? { color: option.color } : {}),
            ...(typeof option.description === "string" || option.description === null
              ? { description: option.description }
              : {}),
          } satisfies ComparablePropertyOption;
        })
        .filter((option): option is ComparablePropertyOption => option !== null)
    : [];

  return options.length > 0 ? { options } : {};
};

const normalizeNumberConfig = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object") {
    return {};
  }

  return typeof (value as { format?: unknown }).format === "string"
    ? { format: (value as { format: string }).format }
    : {};
};

const normalizeUniqueIdConfig = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object") {
    return {};
  }

  return typeof (value as { prefix?: unknown }).prefix === "string" ||
    (value as { prefix?: unknown }).prefix === null
    ? { prefix: (value as { prefix?: string | null }).prefix ?? null }
    : {};
};

const passthroughProperty = (type: string): SchemaPropertyHandler => ({
  normalizeActual: () => ({ [type]: {} }),
  toRequest: () => ({ [type]: {} }),
});

const handlers: Readonly<Record<string, SchemaPropertyHandler>> = {
  title: passthroughProperty("title"),
  rich_text: passthroughProperty("rich_text"),
  number: {
    normalizeActual: (actualProperty) => ({ number: normalizeNumberConfig(actualProperty.number) }),
    toRequest: (property) => ({ number: property.config ?? {} }),
  },
  select: {
    normalizeActual: (actualProperty) => ({
      select: normalizePropertyConfigOptions(actualProperty.select),
    }),
    toRequest: (property) => ({
      select: normalizePropertyConfigOptions(property.config),
    }),
  },
  multi_select: {
    normalizeActual: (actualProperty) => ({
      multi_select: normalizePropertyConfigOptions(actualProperty.multi_select),
    }),
    toRequest: (property) => ({
      multi_select: normalizePropertyConfigOptions(property.config),
    }),
  },
  status: {
    normalizeActual: (actualProperty) => ({
      status: normalizePropertyConfigOptions(actualProperty.status),
    }),
    toRequest: (property) => ({
      status: normalizePropertyConfigOptions(property.config),
    }),
  },
  url: passthroughProperty("url"),
  checkbox: passthroughProperty("checkbox"),
  date: passthroughProperty("date"),
  email: passthroughProperty("email"),
  phone_number: passthroughProperty("phone_number"),
  files: passthroughProperty("files"),
  people: passthroughProperty("people"),
  created_by: passthroughProperty("created_by"),
  created_time: passthroughProperty("created_time"),
  last_edited_by: passthroughProperty("last_edited_by"),
  last_edited_time: passthroughProperty("last_edited_time"),
  unique_id: {
    normalizeActual: (actualProperty) => ({
      unique_id: normalizeUniqueIdConfig(actualProperty.unique_id),
    }),
    toRequest: (property) => ({
      unique_id: normalizeUniqueIdConfig(property.config),
    }),
  },
};

export function requestSchemaProperty(
  type: string,
  property: CanonicalSchemaProperty,
): Record<string, unknown> | null {
  return handlers[type]?.toRequest(property) ?? null;
}

export function normalizeActualSchemaProperty(
  type: string,
  actualProperty: Record<string, unknown>,
): Record<string, unknown> | null {
  return handlers[type]?.normalizeActual(actualProperty) ?? null;
}
