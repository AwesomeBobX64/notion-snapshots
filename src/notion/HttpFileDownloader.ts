import type { DownloadedFile, FileDownloader } from "./FileDownloader.js";

export class HttpFileDownloader implements FileDownloader {
  public static normalizeMimeType(headerValue: string | null): string | undefined {
    if (!headerValue) {
      return undefined;
    }

    return headerValue.split(";")[0]?.trim() ?? undefined;
  }

  public async download(url: string): Promise<DownloadedFile> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
    }

    const mimeType = HttpFileDownloader.normalizeMimeType(response.headers.get("content-type"));

    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      ...(mimeType ? { mimeType } : {}),
    };
  }
}
