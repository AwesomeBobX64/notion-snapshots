import type { BlobStore } from "../cas/BlobStore.js";
import { ContentHash } from "../domain/ContentHash.js";
import type { DestinationFileUploader } from "../notion/DestinationFileUploader.js";
import { NotionPagePropertyCodec } from "../notion/NotionPagePropertyCodec.js";
import type { ObjectStore } from "../cas/ObjectStore.js";

export interface PreparedImportFileValue {
  file: Record<string, unknown> | null;
  uploadedFiles: number;
}

export interface PreparedImportPageAsset {
  asset: Record<string, unknown> | null;
  uploadedFiles: number;
}

export interface UploadedPreparedFileRef {
  fileUploadId: string;
  name: string;
}

export class PreparedImportAssetResolver {
  public constructor(
    private readonly fileUploader: DestinationFileUploader | undefined,
    private readonly objectStore: ObjectStore,
    private readonly blobStore: BlobStore,
  ) {}

  public async prepareFilePropertyValueForCreate(value: unknown): Promise<PreparedImportFileValue> {
    const fileValue = this.asRecord(value);

    if (!fileValue) {
      return this.emptyPreparedFileValue();
    }

    const name = this.optionalString(fileValue.name);
    const uploaded = await this.uploadPreparedFileRef(fileValue.file_ref);

    if (uploaded) {
      return {
        file: this.fileUploadValue(uploaded.fileUploadId, name),
        uploadedFiles: 1,
      };
    }

    const externalFile = this.externalValue(fileValue.external, name);

    if (fileValue.type === "external" && externalFile) {
      return {
        file: externalFile,
        uploadedFiles: 0,
      };
    }

    const existingUploadId = this.fileUploadId(fileValue.file_upload);

    if (fileValue.type === "file_upload" && existingUploadId) {
      return {
        file: this.fileUploadValue(existingUploadId, name),
        uploadedFiles: 0,
      };
    }

    return this.emptyPreparedFileValue();
  }

  public async preparePageAssetForCreate(
    asset: Record<string, unknown> | null,
  ): Promise<PreparedImportPageAsset> {
    if (!asset) {
      return this.emptyPreparedPageAsset();
    }

    if (asset.type === "emoji") {
      return { asset: NotionPagePropertyCodec.restorableIcon(asset), uploadedFiles: 0 };
    }

    const externalAsset = this.externalValue(asset.external);

    if (asset.type === "external" && externalAsset) {
      return { asset: externalAsset, uploadedFiles: 0 };
    }

    if (asset.type === "file") {
      const uploaded = await this.uploadPreparedFileRef(asset.file_ref);

      if (!uploaded) {
        return this.emptyPreparedPageAsset();
      }

      return {
        asset: this.fileUploadValue(uploaded.fileUploadId),
        uploadedFiles: 1,
      };
    }

    const existingUploadId = this.fileUploadId(asset.file_upload);

    if (asset.type === "file_upload" && existingUploadId) {
      return {
        asset: this.fileUploadValue(existingUploadId),
        uploadedFiles: 0,
      };
    }

    return this.emptyPreparedPageAsset();
  }

  public async uploadPreparedFileRef(fileRefHash: unknown): Promise<UploadedPreparedFileRef | null> {
    if (!this.fileUploader || typeof fileRefHash !== "string") {
      return null;
    }

    const fileRef = await this.objectStore.get<{
      canonical: {
        name: string;
        mime_type: string;
        blob_ref: string;
      };
    }>(ContentHash.parse(fileRefHash));
    const bytes = await this.blobStore.get(ContentHash.parse(fileRef.canonical.blob_ref));
    const fileUploadId = await this.fileUploader.uploadFile({
      filename: fileRef.canonical.name,
      mimeType: fileRef.canonical.mime_type,
      bytes,
    });

    return {
      fileUploadId,
      name: fileRef.canonical.name,
    };
  }

  private emptyPreparedFileValue(): PreparedImportFileValue {
    return {
      file: null,
      uploadedFiles: 0,
    };
  }

  private emptyPreparedPageAsset(): PreparedImportPageAsset {
    return {
      asset: null,
      uploadedFiles: 0,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : null;
  }

  private optionalString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
  }

  private fileUploadId(value: unknown): string | null {
    const fileUpload = this.asRecord(value);
    return fileUpload && typeof fileUpload.id === "string"
      ? fileUpload.id
      : null;
  }

  private externalValue(
    value: unknown,
    name?: string,
  ): Record<string, unknown> | null {
    const external = this.asRecord(value);
    const url = external && typeof external.url === "string"
      ? external.url
      : null;

    if (!url) {
      return null;
    }

    return {
      type: "external",
      ...(name ? { name } : {}),
      external: {
        url,
      },
    };
  }

  private fileUploadValue(
    fileUploadId: string,
    name?: string,
  ): Record<string, unknown> {
    return {
      type: "file_upload",
      ...(name ? { name } : {}),
      file_upload: {
        id: fileUploadId,
      },
    };
  }
}
