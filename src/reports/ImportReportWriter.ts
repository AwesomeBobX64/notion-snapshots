export interface ImportReportSummary {
  targetPageId: string;
  createdPages: number;
  createdBlocks: number;
  uploadedFiles: number;
  preservedWithTransformation: number;
  skippedUnsupported: number;
  failures: number;
  skippedByType: Record<string, number>;
  failuresByType: Record<string, number>;
}

export class ImportReportWriter {
  public static render(summary: ImportReportSummary): string {
    const skippedTypes = Object.entries(summary.skippedByType)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([blockType, count]) => `- \`${blockType}\`: ${count}`);
    const failureTypes = Object.entries(summary.failuresByType)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([failureType, count]) => `- \`${failureType}\`: ${count}`);

    return [
      "# Import Report",
      "",
      "## Summary",
      "",
      `- Target page: \`${summary.targetPageId}\``,
      `- Pages created: ${summary.createdPages}`,
      `- Blocks replayed: ${summary.createdBlocks}`,
      `- Files uploaded: ${summary.uploadedFiles}`,
      `- Preserved with transformation: ${summary.preservedWithTransformation}`,
      `- Skipped unsupported: ${summary.skippedUnsupported}`,
      `- Failures: ${summary.failures}`,
      "",
      "## Skipped By Type",
      "",
      ...(skippedTypes.length > 0 ? skippedTypes : ["- None"]),
      "",
      "## Failures By Type",
      "",
      ...(failureTypes.length > 0 ? failureTypes : ["- None"]),
      "",
    ].join("\n");
  }
}
