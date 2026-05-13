export interface DownloadedFile {
  bytes: Uint8Array;
  mimeType?: string;
}

export interface FileDownloader {
  download(url: string): Promise<DownloadedFile>;
}
