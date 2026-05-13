export interface ImportRunStatsResult {
  createdPages: number;
  createdBlocks: number;
  transformedBlocks: number;
  skippedBlocks: number;
  uploadedFiles: number;
  failures: number;
}

export class ImportRunStats {
  public readonly skippedByType: Record<string, number>;
  public readonly failuresByType: Record<string, number>;

  private readonly totals: ImportRunStatsResult = {
    createdPages: 0,
    createdBlocks: 0,
    transformedBlocks: 0,
    skippedBlocks: 0,
    uploadedFiles: 0,
    failures: 0,
  };

  public constructor(
    skippedByType: Record<string, number> = {},
    failuresByType: Record<string, number> = {},
  ) {
    this.skippedByType = skippedByType;
    this.failuresByType = failuresByType;
  }

  public recordCreatedPages(count = 1): void {
    this.totals.createdPages += count;
  }

  public recordCreatedBlocks(count = 1): void {
    this.totals.createdBlocks += count;
  }

  public recordTransformedBlocks(count = 1): void {
    this.totals.transformedBlocks += count;
  }

  public recordSkippedBlocks(count = 1): void {
    this.totals.skippedBlocks += count;
  }

  public recordSkippedType(type: string, count = 1): void {
    this.incrementCounter(this.skippedByType, type, count);
  }

  public recordUploadedFiles(count = 1): void {
    this.totals.uploadedFiles += count;
  }

  public recordFailure(type: string, count = 1): void {
    this.totals.failures += count;
    this.incrementCounter(this.failuresByType, type, count);
  }

  public toResult(): ImportRunStatsResult {
    return { ...this.totals };
  }

  public toReportSummary(targetPageId: string): {
    targetPageId: string;
    createdPages: number;
    createdBlocks: number;
    uploadedFiles: number;
    preservedWithTransformation: number;
    skippedUnsupported: number;
    failures: number;
    skippedByType: Record<string, number>;
    failuresByType: Record<string, number>;
  } {
    return {
      targetPageId,
      createdPages: this.totals.createdPages,
      createdBlocks: this.totals.createdBlocks,
      uploadedFiles: this.totals.uploadedFiles,
      preservedWithTransformation: this.totals.transformedBlocks,
      skippedUnsupported: this.totals.skippedBlocks,
      failures: this.totals.failures,
      skippedByType: this.skippedByType,
      failuresByType: this.failuresByType,
    };
  }

  private incrementCounter(counters: Record<string, number>, key: string, count: number): void {
    counters[key] = (counters[key] ?? 0) + count;
  }
}
