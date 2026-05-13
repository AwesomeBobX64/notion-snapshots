import type { Client } from "@notionhq/client";
import type { DestinationFileUploader, UploadDestinationFileInput } from "./DestinationFileUploader.js";

export class NotionDestinationFileUploader implements DestinationFileUploader {
  public constructor(private readonly client: Client) {}

  public async uploadFile(input: UploadDestinationFileInput): Promise<string> {
    const created = await this.client.fileUploads.create({
      mode: "single_part",
      filename: input.filename,
      content_type: input.mimeType,
    });

    await this.client.fileUploads.send({
      file_upload_id: created.id,
      file: {
        filename: input.filename,
        data: new Blob([Buffer.from(input.bytes)], { type: input.mimeType }),
      },
    });

    return created.id;
  }
}
