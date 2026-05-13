import type { ContentHash } from "../domain/ContentHash.js";
import { Sha256 } from "../cas/Sha256.js";
import { NotionRichText } from "./NotionRichText.js";

export interface CanonicalNotionFileRefRecord {
  object_type: "notion.file_ref";
  schema_version: 1;
  content_hash: string;
  source: {
    id: string;
  };
  canonical: {
    name: string;
    mime_type: string;
    size_bytes: number;
    blob_ref: string;
    original_block_type: string;
  };
}

export class NotionFileFactory {
  public static createFileRef(
    block: Record<string, unknown>,
    blobHash: ContentHash,
    mimeType: string,
    sizeBytes: number,
  ): CanonicalNotionFileRefRecord {
    const blockType = NotionFileFactory.extractBlockType(block);
    const filePayload = NotionRichText.pick(block, blockType);
    return NotionFileFactory.createFileRefFromPayload({
      sourceId: NotionFileFactory.extractBlockId(block),
      filePayload,
      blobHash,
      mimeType,
      sizeBytes,
      originalBlockType: blockType,
      fallbackName: blockType,
    });
  }

  public static extractFileUrl(block: Record<string, unknown>): string | null {
    const blockType = NotionFileFactory.extractBlockType(block);
    return NotionFileFactory.extractFileUrlFromValue(NotionRichText.pick(block, blockType));
  }

  public static extractFileUrlFromValue(filePayload: unknown): string | null {
    return NotionFileFactory.extractFileUrlFromPayload(filePayload);
  }

  public static createFileRefFromPayload(input: {
    sourceId: string;
    filePayload: unknown;
    blobHash: ContentHash;
    mimeType: string;
    sizeBytes: number;
    originalBlockType: string;
    fallbackName: string;
  }): CanonicalNotionFileRefRecord {
    const url = NotionFileFactory.extractFileUrlFromPayload(input.filePayload);
    const canonical: Omit<CanonicalNotionFileRefRecord, "content_hash"> = {
      object_type: "notion.file_ref",
      schema_version: 1,
      source: {
        id: input.sourceId,
      },
      canonical: {
        name: NotionFileFactory.extractName(
          input.originalBlockType,
          input.filePayload,
          url,
          input.mimeType,
          input.fallbackName,
        ),
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes,
        blob_ref: input.blobHash.toString(),
        original_block_type: input.originalBlockType,
      },
    };

    return {
      ...canonical,
      content_hash: Sha256.hashCanonicalJson(canonical).toString(),
    };
  }

  private static extractFileUrlFromPayload(filePayload: unknown): string | null {
    if (!filePayload || typeof filePayload !== "object") {
      return null;
    }

    const type = NotionRichText.pick(filePayload, "type");

    if (type === "file") {
      const file = NotionRichText.pick(filePayload, "file");
      const url = NotionRichText.pick(file, "url");
      return typeof url === "string" ? url : null;
    }

    if (type === "external") {
      const external = NotionRichText.pick(filePayload, "external");
      const url = NotionRichText.pick(external, "url");
      return typeof url === "string" ? url : null;
    }

    return null;
  }

  private static extractName(
    blockType: string,
    filePayload: unknown,
    url: string | null,
    mimeType: string,
    fallbackName: string = blockType,
  ): string {
    const explicitName = NotionRichText.pick(filePayload, "name");

    if (typeof explicitName === "string" && explicitName.length > 0) {
      return explicitName;
    }

    if (url) {
      try {
        const pathname = new URL(url).pathname;
        const basename = pathname.split("/").pop();

        if (basename) {
          return basename;
        }
      } catch {
        // Fall through to mime-based default.
      }
    }

    return `${fallbackName}.${NotionFileFactory.extensionForMimeType(mimeType)}`;
  }

  private static extensionForMimeType(mimeType: string): string {
    switch (mimeType) {
      case "image/png":
        return "png";
      case "application/pdf":
        return "pdf";
      case "text/plain":
        return "txt";
      default:
        return "bin";
    }
  }

  private static extractBlockType(block: Record<string, unknown>): string {
    const type = NotionRichText.pick(block, "type");

    if (typeof type !== "string" || type.length === 0) {
      throw new Error("Notion file block payload is missing a type");
    }

    return type;
  }

  private static extractBlockId(block: Record<string, unknown>): string {
    const id = NotionRichText.pick(block, "id");

    if (typeof id !== "string" || id.length === 0) {
      throw new Error("Notion file block payload is missing an id");
    }

    return id;
  }
}
