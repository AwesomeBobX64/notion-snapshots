import { Client, LogLevel } from "@notionhq/client";

export class NotionClientFactory {
  public static create(token: string): Client {
    return new Client({
      auth: token,
      logLevel: LogLevel.ERROR,
    });
  }
}
