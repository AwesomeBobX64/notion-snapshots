export interface UploadDestinationFileInput {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface DestinationFileUploader {
  uploadFile(input: UploadDestinationFileInput): Promise<string>;
}
