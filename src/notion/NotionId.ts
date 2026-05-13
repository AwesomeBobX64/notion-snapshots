export class NotionId {
  private static readonly HYPHENATED_UUID_PATTERN =
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

  private static readonly COMPACT_UUID_PATTERN = /^[a-f0-9]{32}$/i;

  public static parsePageId(input: string): string {
    const trimmed = input.trim();

    if (NotionId.HYPHENATED_UUID_PATTERN.test(trimmed)) {
      return trimmed.toLowerCase();
    }

    const compact = NotionId.extractCompactId(trimmed);

    if (!compact) {
      throw new Error(`Could not parse a Notion page id from: ${input}`);
    }

    return NotionId.hydrate(compact);
  }

  public static parseBlockId(input: string): string {
    return NotionId.parsePageId(input);
  }

  public static toSourcePageRef(pageId: string): string {
    return `notion://source/page/${pageId}`;
  }

  public static toSourceBlockRef(blockId: string): string {
    return `notion://source/block/${blockId}`;
  }

  public static toSourceDatabaseRef(databaseId: string): string {
    return `notion://source/database/${databaseId}`;
  }

  private static extractCompactId(input: string): string | null {
    const direct = input.replaceAll("-", "");

    if (NotionId.COMPACT_UUID_PATTERN.test(direct)) {
      return direct.toLowerCase();
    }

    const match = /([a-f0-9]{32})/i.exec(input);
    return match?.[1]?.toLowerCase() ?? null;
  }

  private static hydrate(compactId: string): string {
    return [
      compactId.slice(0, 8),
      compactId.slice(8, 12),
      compactId.slice(12, 16),
      compactId.slice(16, 20),
      compactId.slice(20, 32),
    ].join("-");
  }
}
