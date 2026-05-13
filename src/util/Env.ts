export type NotionTokenRole = "source" | "destination";

export interface ResolveNotionTokenOptions {
  explicitToken?: string | undefined;
  role: NotionTokenRole;
  environment?: NodeJS.ProcessEnv;
}

export class Env {
  public static resolveNotionToken(options: ResolveNotionTokenOptions): string | undefined {
    const environment = options.environment ?? process.env;

    if (options.explicitToken && options.explicitToken.length > 0) {
      return options.explicitToken;
    }

    if (options.role === "source" && environment.NOTION_SOURCE_TOKEN) {
      return environment.NOTION_SOURCE_TOKEN;
    }

    if (options.role === "destination" && environment.NOTION_DESTINATION_TOKEN) {
      return environment.NOTION_DESTINATION_TOKEN;
    }

    return environment.NOTION_TOKEN;
  }
}
