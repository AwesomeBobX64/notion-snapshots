import { isFullPage, type Client } from "@notionhq/client";
import type { CreatePageShellInput, DestinationPageWriter } from "./DestinationPageWriter.js";

export class NotionDestinationPageWriter implements DestinationPageWriter {
  public constructor(private readonly client: Client) {}

  public async createPageShell(input: CreatePageShellInput): Promise<string> {
    const properties =
      input.properties && Object.keys(input.properties).length > 0
        ? structuredClone(input.properties)
        : {
            title: {
              title: [
                {
                  type: "text",
                  text: {
                    content: input.title,
                  },
                },
              ],
            },
          };
    const response = await this.client.pages.create({
      parent: {
        type: "page_id",
        page_id: input.parentId,
      },
      properties,
      ...(input.icon ? { icon: structuredClone(input.icon) } : {}),
      ...(input.cover ? { cover: structuredClone(input.cover) } : {}),
    } as never);

    if (!isFullPage(response)) {
      throw new Error(`Expected a full Notion page response when creating "${input.title}"`);
    }

    return response.id;
  }
}
