export interface ExportRunStats {
  blockCount: number;
  fileCount: number;
  pageCount: number;
  databaseCount: number;
  rowCount: number;
  unsupportedCount: number;
  failureCount: number;
}

export type ExportRunStatsInput = Partial<ExportRunStats> | null | undefined;

export class ExportRunStatsAccumulator {
  private readonly totals: ExportRunStats = ExportRunStatsAccumulator.empty();

  public static empty(): ExportRunStats {
    return {
      blockCount: 0,
      fileCount: 0,
      pageCount: 0,
      databaseCount: 0,
      rowCount: 0,
      unsupportedCount: 0,
      failureCount: 0,
    };
  }

  public add(stats: ExportRunStatsInput): void {
    if (!stats) {
      return;
    }

    this.totals.blockCount += stats.blockCount ?? 0;
    this.totals.fileCount += stats.fileCount ?? 0;
    this.totals.pageCount += stats.pageCount ?? 0;
    this.totals.databaseCount += stats.databaseCount ?? 0;
    this.totals.rowCount += stats.rowCount ?? 0;
    this.totals.unsupportedCount += stats.unsupportedCount ?? 0;
    this.totals.failureCount += stats.failureCount ?? 0;
  }

  public snapshot(): ExportRunStats {
    return {
      ...this.totals,
    };
  }
}
