export class CanonicalJson {
  public static stringify(value: unknown): string {
    return JSON.stringify(CanonicalJson.normalize(value));
  }

  public static normalize<T>(value: T): T {
    return CanonicalJson.normalizeValue(value) as T;
  }

  private static normalizeValue(value: unknown): unknown {
    if (value === null) {
      return null;
    }

    if (Array.isArray(value)) {
      return value.map((item) => CanonicalJson.normalizeValue(item));
    }

    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      const normalizedEntries = Object.entries(record)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, entryValue]) => [key, CanonicalJson.normalizeValue(entryValue)]);

      return Object.fromEntries(normalizedEntries);
    }

    return value;
  }
}
