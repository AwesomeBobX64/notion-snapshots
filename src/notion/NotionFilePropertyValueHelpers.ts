type UnknownValueNormalizer = (value: unknown) => unknown;
type NotionFileNormalizer = (
  normalized: Record<string, unknown>,
  index: number,
  fileRefs: (string | null)[],
  normalizeUnknownValue: UnknownValueNormalizer,
) => Record<string, unknown>;
type ComparableFileNormalizer = (
  normalized: Record<string, unknown>,
  name: string | null,
  hasFileRef: boolean,
) => Record<string, unknown> | null;
type FileRequestNormalizer = (
  normalized: Record<string, unknown>,
  name: string | null,
) => Record<string, unknown> | null;

const pickString = (value: unknown, key: string): string | null => {
  if (!value || typeof value !== "object" || typeof (value as Record<string, unknown>)[key] !== "string") {
    return null;
  }

  return (value as Record<string, unknown>)[key] as string;
};

const normalizeComparableExternal = (
  file: Record<string, unknown>,
  name: string | null,
): Record<string, unknown> => ({
  type: "external",
  ...(name ? { name } : {}),
  ...(file.external &&
  typeof file.external === "object" &&
  typeof (file.external as { url?: unknown }).url === "string"
    ? { external: { url: (file.external as { url: string }).url } }
    : {}),
});

const FILE_NORMALIZERS: Readonly<Record<string, NotionFileNormalizer>> = {
  external: (normalized, index, fileRefs) => {
    const name = pickString(normalized, "name");
    const url = pickString(normalized.external, "url");
    return {
      type: "external",
      ...(name ? { name } : {}),
      ...(fileRefs[index] ? { file_ref: fileRefs[index] } : {}),
      ...(url ? { external: { url } } : {}),
    };
  },
  file: (normalized, index, fileRefs) => {
    const name = pickString(normalized, "name");
    return {
      type: "file",
      ...(name ? { name } : {}),
      file_ref: fileRefs[index] ?? null,
    };
  },
  file_upload: (normalized) => {
    const name = pickString(normalized, "name");
    const id = pickString(normalized.file_upload, "id");
    return {
      type: "file_upload",
      ...(name ? { name } : {}),
      ...(id ? { file_upload: { id } } : {}),
    };
  },
};

const COMPARABLE_FILE_NORMALIZERS: Readonly<Record<string, ComparableFileNormalizer>> = {
  file: (_, name) => ({
    type: "file",
    ...(name ? { name } : {}),
  }),
  file_upload: (_, name) => ({
    type: "file",
    ...(name ? { name } : {}),
  }),
  external: (normalized, name, hasFileRef) =>
    hasFileRef
      ? {
          type: "file",
          ...(name ? { name } : {}),
        }
      : normalizeComparableExternal(normalized, name),
};

const FILE_REQUEST_NORMALIZERS: Readonly<Record<string, FileRequestNormalizer>> = {
  external: (normalized, name) => {
    const url = pickString(normalized.external, "url");
    return url
      ? {
          type: "external",
          ...(name ? { name } : {}),
          external: {
            url,
          },
        }
      : null;
  },
  file_upload: (normalized, name) => {
    const id = pickString(normalized.file_upload, "id");
    return id
      ? {
          type: "file_upload",
          ...(name ? { name } : {}),
          file_upload: {
            id,
          },
        }
      : null;
  },
};

export function normalizeNotionFiles(
  value: unknown,
  fileRefs: (string | null)[],
  normalizeUnknownValue: UnknownValueNormalizer,
): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((file, index) => {
    if (!file || typeof file !== "object") {
      return {
        value: normalizeUnknownValue(file),
      };
    }

    const normalized = file as Record<string, unknown>;
    const normalizer =
      typeof normalized.type === "string" ? FILE_NORMALIZERS[normalized.type] : undefined;
    return normalizer
      ? normalizer(normalized, index, fileRefs, normalizeUnknownValue)
      : (normalizeUnknownValue(normalized) as Record<string, unknown>);
  });
}

export function normalizeComparableNotionFiles(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const comparableFiles: Record<string, unknown>[] = [];

  for (const file of value) {
    if (!file || typeof file !== "object") {
      continue;
    }

    const normalized = file as Record<string, unknown>;
    const name = pickString(normalized, "name");
    const hasFileRef = typeof normalized.file_ref === "string" && normalized.file_ref.length > 0;

    const normalizer =
      typeof normalized.type === "string" ? COMPARABLE_FILE_NORMALIZERS[normalized.type] : undefined;
    const comparableFile = normalizer?.(normalized, name, hasFileRef);
    if (comparableFile) {
      comparableFiles.push(comparableFile);
    }
  }

  return comparableFiles;
}

export function toNotionFileRequestList(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const files: Record<string, unknown>[] = [];

  for (const file of value) {
    if (!file || typeof file !== "object") {
      continue;
    }

    const normalized = file as Record<string, unknown>;
    const name = pickString(normalized, "name");
    const normalizer =
      typeof normalized.type === "string" ? FILE_REQUEST_NORMALIZERS[normalized.type] : undefined;
    const requestFile = normalizer?.(normalized, name);
    if (requestFile) {
      files.push(requestFile);
    }
  }

  return files;
}
