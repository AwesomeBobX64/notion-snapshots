type UnknownValueNormalizer = (value: unknown) => unknown;
type PageAssetNormalizer = (
  value: Record<string, unknown>,
  fileRef: string | null,
  normalizeUnknownValue: UnknownValueNormalizer,
) => Record<string, unknown> | null;
type ComparablePageAssetNormalizer = (value: Record<string, unknown>) => Record<string, unknown> | null;

const pickString = (value: unknown, key: string): string | null => {
  if (!value || typeof value !== "object" || typeof (value as Record<string, unknown>)[key] !== "string") {
    return null;
  }

  return (value as Record<string, unknown>)[key] as string;
};

const normalizeExternalAsset = (value: unknown): Record<string, unknown> | null => {
  const url = pickString(value, "url");
  return url ? { type: "external", external: { url } } : null;
};

const normalizeFileUploadAsset = (value: unknown): Record<string, unknown> => {
  const id = pickString(value, "id");
  return id ? { type: "file_upload", file_upload: { id } } : { type: "file_upload" };
};

const comparableExternalAsset = (value: Record<string, unknown>): Record<string, unknown> | null => {
  if (
    !value.external ||
    typeof value.external !== "object" ||
    typeof (value.external as { url?: unknown }).url !== "string"
  ) {
    return null;
  }

  return {
    type: "external",
    external: {
      url: (value.external as { url: string }).url,
    },
  };
};

const ICON_NORMALIZERS: Readonly<Record<string, PageAssetNormalizer>> = {
  emoji: (value) => (typeof value.emoji === "string" ? { type: "emoji", emoji: value.emoji } : null),
  external: (value) => normalizeExternalAsset(value.external),
  file_upload: (value) => normalizeFileUploadAsset(value.file_upload),
  custom_emoji: (value) => {
    const customEmoji =
      value.custom_emoji && typeof value.custom_emoji === "object"
        ? (value.custom_emoji as Record<string, unknown>)
        : null;
    const id = pickString(customEmoji, "id");
    if (!id) {
      return { type: "custom_emoji" };
    }

    return {
      type: "custom_emoji",
      custom_emoji: {
        id,
        ...(typeof customEmoji?.name === "string" ? { name: customEmoji.name } : {}),
      },
    };
  },
  file: (_, fileRef) => ({
    type: "file",
    file_ref: fileRef,
  }),
};

const COVER_NORMALIZERS: Readonly<Record<string, PageAssetNormalizer>> = {
  external: (value) => normalizeExternalAsset(value.external),
  file_upload: (value) => normalizeFileUploadAsset(value.file_upload),
  file: (_, fileRef) => ({
    type: "file",
    file_ref: fileRef,
  }),
};

const COMPARABLE_ICON_NORMALIZERS: Readonly<Record<string, ComparablePageAssetNormalizer>> = {
  emoji: (value) => (typeof value.emoji === "string" ? { type: "emoji", emoji: value.emoji } : null),
  external: comparableExternalAsset,
  file: () => ({ type: "file" }),
  file_upload: () => ({ type: "file" }),
};

const COMPARABLE_COVER_NORMALIZERS: Readonly<Record<string, ComparablePageAssetNormalizer>> = {
  external: comparableExternalAsset,
  file: () => ({ type: "file" }),
  file_upload: () => ({ type: "file" }),
};

export function normalizeIconValue(
  value: unknown,
  fileRef: string | null,
  normalizeUnknownValue: UnknownValueNormalizer,
): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const icon = value as Record<string, unknown>;
  const normalizer = typeof icon.type === "string" ? ICON_NORMALIZERS[icon.type] : undefined;
  return normalizer
    ? normalizer(icon, fileRef, normalizeUnknownValue)
    : (normalizeUnknownValue(icon) as Record<string, unknown>);
}

export function normalizeCoverValue(
  value: unknown,
  fileRef: string | null,
  normalizeUnknownValue: UnknownValueNormalizer,
): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const cover = value as Record<string, unknown>;
  const normalizer = typeof cover.type === "string" ? COVER_NORMALIZERS[cover.type] : undefined;
  return normalizer
    ? normalizer(cover, fileRef, normalizeUnknownValue)
    : (normalizeUnknownValue(cover) as Record<string, unknown>);
}

export function comparableNormalizedIcon(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || typeof (value as { type?: unknown }).type !== "string") {
    return null;
  }

  const normalized = value as Record<string, unknown>;
  const normalizer =
    typeof normalized.type === "string" ? COMPARABLE_ICON_NORMALIZERS[normalized.type] : undefined;
  return normalizer ? normalizer(normalized) : null;
}

export function comparableNormalizedCover(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || typeof (value as { type?: unknown }).type !== "string") {
    return null;
  }

  const normalized = value as Record<string, unknown>;
  const normalizer =
    typeof normalized.type === "string" ? COMPARABLE_COVER_NORMALIZERS[normalized.type] : undefined;
  return normalizer ? normalizer(normalized) : null;
}
