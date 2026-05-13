export interface CanonicalRequestRichTextSegment {
  type?: unknown;
  plain_text?: unknown;
  href?: unknown;
  text?: {
    content?: unknown;
    link?: {
      url?: unknown;
    } | null;
  };
  equation?: {
    expression?: unknown;
  };
  annotations?: Record<string, unknown>;
}

interface RequestRichTextAnnotations<Color extends string> {
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  underline: boolean;
  code: boolean;
  color: Color;
}

export type RequestRichText<Color extends string = string> =
  | {
      type: "text";
      text: { content: string; link: { url: string } | null };
      annotations: RequestRichTextAnnotations<Color>;
    }
  | {
      type: "equation";
      equation: { expression: string };
      annotations: RequestRichTextAnnotations<Color>;
    };

export interface RequestRichTextOptions<Color extends string = string> {
  toColor: (value: unknown) => Color;
  isTextContentUsable?: (content: string) => boolean;
  isEquationExpressionUsable?: (expression: string) => boolean;
}

export type RequestFile =
  | {
      type: "external";
      name?: string;
      external: {
        url: string;
      };
    }
  | {
      type: "file_upload";
      name?: string;
      file_upload: {
        id: string;
      };
    };

const NOTION_RICH_TEXT_CONTENT_LIMIT = 2000;
type RequestFileNormalizer = (
  normalized: Record<string, unknown>,
  name: string | undefined,
) => RequestFile | null;

const REQUEST_FILE_NORMALIZERS: Readonly<Record<string, RequestFileNormalizer>> = {
  external: (normalized, name) => {
    const url = pickString(normalized.external, "url");
    return url
      ? {
          type: "external",
          ...(name ? { name } : {}),
          external: { url },
        }
      : null;
  },
  file_upload: (normalized, name) => {
    const id = pickString(normalized.file_upload, "id");
    return id
      ? {
          type: "file_upload",
          ...(name ? { name } : {}),
          file_upload: { id },
        }
      : null;
  },
};

export function toRequestRichText<Color extends string = string>(
  value: unknown,
  options: RequestRichTextOptions<Color>,
): RequestRichText<Color>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const segments = value
    .map((segment) => toRequestRichTextItem(segment, options))
    .filter((segment): segment is RequestRichText<Color> => segment !== null);

  return compactRequestRichText(segments);
}

export function toRequestFiles(value: unknown): RequestFile[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const files: RequestFile[] = [];

  for (const file of value) {
    if (!file || typeof file !== "object") {
      continue;
    }

    const normalized = file as Record<string, unknown>;
    const name = pickString(normalized, "name");
    const normalizer =
      typeof normalized.type === "string" ? REQUEST_FILE_NORMALIZERS[normalized.type] : undefined;
    const requestFile = normalizer?.(normalized, name);
    if (requestFile) {
      files.push(requestFile);
    }
  }

  return files;
}

function toRequestRichTextItem<Color extends string = string>(
  value: unknown,
  options: RequestRichTextOptions<Color>,
): RequestRichText<Color> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const segment = value as CanonicalRequestRichTextSegment;
  if (typeof segment.plain_text !== "string") {
    return null;
  }

  const normalizedSegment = segment as CanonicalRequestRichTextSegment & {
    plain_text: string;
  };
  const annotations = toRequestRichTextAnnotations(normalizedSegment, options);

  return (
    toRequestEquation(normalizedSegment, annotations, options) ??
    toRequestText(normalizedSegment, annotations, options)
  );
}

function toRequestRichTextAnnotations<Color extends string>(
  segment: CanonicalRequestRichTextSegment,
  options: RequestRichTextOptions<Color>,
): RequestRichTextAnnotations<Color> {
  return {
    bold: segment.annotations?.bold === true,
    italic: segment.annotations?.italic === true,
    strikethrough: segment.annotations?.strikethrough === true,
    underline: segment.annotations?.underline === true,
    code: segment.annotations?.code === true,
    color: options.toColor(segment.annotations?.color),
  };
}

function toRequestEquation<Color extends string>(
  segment: CanonicalRequestRichTextSegment,
  annotations: RequestRichTextAnnotations<Color>,
  options: RequestRichTextOptions<Color>,
): RequestRichText<Color> | null {
  const expression = pickString(segment.equation, "expression");

  if (
    segment.type !== "equation" ||
    !expression ||
    !(options.isEquationExpressionUsable?.(expression) ?? true)
  ) {
    return null;
  }

  return {
    type: "equation",
    equation: { expression },
    annotations,
  };
}

function toRequestText<Color extends string>(
  segment: CanonicalRequestRichTextSegment & { plain_text: string },
  annotations: RequestRichTextAnnotations<Color>,
  options: RequestRichTextOptions<Color>,
): RequestRichText<Color> {
  const linkUrl = toRequestTextLinkUrl(segment);

  return {
    type: "text",
    text: {
      content: toRequestTextContent(segment, options),
      link: linkUrl ? { url: linkUrl } : null,
    },
    annotations,
  };
}

function toRequestTextContent<Color extends string>(
  segment: CanonicalRequestRichTextSegment & { plain_text: string },
  options: RequestRichTextOptions<Color>,
): string {
  const content = pickString(segment.text, "content");

  if (content !== undefined && (options.isTextContentUsable?.(content) ?? true)) {
    return content;
  }

  return segment.plain_text;
}

function toRequestTextLinkUrl(
  segment: CanonicalRequestRichTextSegment,
): string | undefined {
  return (
    pickString(pickObject(segment.text, "link"), "url") ??
    (typeof segment.href === "string" ? segment.href : undefined)
  );
}

function pickObject(
  value: unknown,
  key: string,
): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return candidate && typeof candidate === "object"
    ? (candidate as Record<string, unknown>)
    : undefined;
}

function pickString(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" ? candidate : undefined;
}

function compactRequestRichText<Color extends string>(
  segments: RequestRichText<Color>[],
): RequestRichText<Color>[] {
  const compacted: RequestRichText<Color>[] = [];

  for (const segment of segments) {
    if (!appendCompactedRichTextSegment(compacted, segment)) {
      compacted.push(structuredClone(segment));
    }
  }

  return compacted;
}

function appendCompactedRichTextSegment<Color extends string>(
  compacted: RequestRichText<Color>[],
  segment: RequestRichText<Color>,
): boolean {
  const previous = compacted.at(-1);
  if (
    previous?.type !== "text" ||
    segment.type !== "text" ||
    !canCompactTextSegments(previous, segment)
  ) {
    return false;
  }

  previous.text.content += segment.text.content;
  return true;
}

function canCompactTextSegments<Color extends string>(
  previous: Extract<RequestRichText<Color>, { type: "text" }>,
  current: Extract<RequestRichText<Color>, { type: "text" }>,
): boolean {
  return (
    sameAnnotations(previous.annotations, current.annotations) &&
    sameLink(previous.text.link, current.text.link) &&
    previous.text.content.length + current.text.content.length <= NOTION_RICH_TEXT_CONTENT_LIMIT
  );
}

function sameAnnotations<Color extends string>(
  left: RequestRichTextAnnotations<Color>,
  right: RequestRichTextAnnotations<Color>,
): boolean {
  return (
    left.bold === right.bold &&
    left.italic === right.italic &&
    left.strikethrough === right.strikethrough &&
    left.underline === right.underline &&
    left.code === right.code &&
    left.color === right.color
  );
}

function sameLink(
  left: { url: string } | null,
  right: { url: string } | null,
): boolean {
  return left?.url === right?.url;
}
