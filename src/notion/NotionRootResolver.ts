import type { NotionDatabaseReader } from "./NotionDatabaseReader.js";
import { NotionId } from "./NotionId.js";
import type { NotionPageReader } from "./NotionPageReader.js";

export type ResolvedNotionRoot =
  | {
      kind: "page";
      id: string;
      sourceId: string;
    }
  | {
      kind: "database";
      id: string;
      sourceId: string;
    };

export interface NotionRootResolverLike {
  resolveRoot(input: string): Promise<ResolvedNotionRoot>;
}

export class NotionRootResolver implements NotionRootResolverLike {
  public constructor(
    private readonly pageReader: NotionPageReader,
    private readonly databaseReader: NotionDatabaseReader,
  ) {}

  public async resolveRoot(input: string): Promise<ResolvedNotionRoot> {
    const normalizedId = NotionId.parsePageId(input);

    if (this.shouldTryDatabaseFirst(input)) {
      try {
        await this.databaseReader.fetchDatabase(normalizedId);
        return {
          kind: "database",
          id: normalizedId,
          sourceId: NotionId.toSourceDatabaseRef(normalizedId),
        };
      } catch {
        // Fall through to page resolution.
      }
    }

    try {
      await this.pageReader.fetchPage(normalizedId);
      return {
        kind: "page",
        id: normalizedId,
        sourceId: NotionId.toSourcePageRef(normalizedId),
      };
    } catch (pageError) {
      try {
        await this.databaseReader.fetchDatabase(normalizedId);
        return {
          kind: "database",
          id: normalizedId,
          sourceId: NotionId.toSourceDatabaseRef(normalizedId),
        };
      } catch {
        throw pageError;
      }
    }
  }

  private shouldTryDatabaseFirst(input: string): boolean {
    try {
      const url = new URL(input);
      return url.searchParams.has("v");
    } catch {
      return false;
    }
  }
}
