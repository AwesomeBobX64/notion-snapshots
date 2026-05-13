import { isFullDatabase, isFullPage, type Client } from "@notionhq/client";
import type {
  CreateDatabaseRowInput,
  CreateInlineDatabaseInput,
  DestinationDatabaseWriter,
} from "./DestinationDatabaseWriter.js";

export class NotionDestinationDatabaseWriter implements DestinationDatabaseWriter {
  public constructor(private readonly client: Client) {}

  public async createInlineDatabase(
    input: CreateInlineDatabaseInput,
  ): Promise<{ databaseId: string; dataSourceId: string }> {
    const response = await this.client.databases.create({
      parent: {
        type: "page_id",
        page_id: input.parentPageId,
      },
      title: [
        {
          type: "text",
          text: {
            content: input.title,
          },
        },
      ],
      ...(input.description.length > 0 ? { description: input.description as never } : {}),
      is_inline: true,
      initial_data_source: {
        properties: input.properties as never,
      },
    });

    if (!isFullDatabase(response)) {
      throw new Error(`Expected a full Notion database response when creating "${input.title}"`);
    }

    const dataSourceId = response.data_sources[0]?.id;

    if (!dataSourceId) {
      throw new Error(`Created database "${input.title}" is missing an initial data source`);
    }

    return {
      databaseId: response.id,
      dataSourceId,
    };
  }

  public async createRowPage(input: CreateDatabaseRowInput): Promise<string> {
    const response = await this.client.pages.create({
      parent: {
        type: "data_source_id",
        data_source_id: input.dataSourceId,
      },
      properties: input.properties as never,
    });

    if (!isFullPage(response)) {
      throw new Error(`Expected a full Notion page response when creating a row page`);
    }

    return response.id;
  }
}
