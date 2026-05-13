import type { SnapshotManifestData, SnapshotStatus } from "../domain/SnapshotManifest.js";

export interface ExportReportSummary {
  rootSourceId: string;
  status: SnapshotStatus;
  counts: SnapshotManifestData["counts"];
}

export class ExportReportWriter {
  public static render(summary: ExportReportSummary): string {
    return [
      "# Export Report",
      "",
      "## Summary",
      "",
      `- Root: \`${summary.rootSourceId}\``,
      `- Status: \`${summary.status}\``,
      `- Pages exported: ${summary.counts.pages}`,
      `- Blocks exported: ${summary.counts.blocks}`,
      `- Files exported: ${summary.counts.files}`,
      `- Databases exported: ${summary.counts.databases}`,
      `- Rows exported: ${summary.counts.rows}`,
      `- Unsupported objects: ${summary.counts.unsupported}`,
      `- Failures: ${summary.counts.failures}`,
      "",
    ].join("\n");
  }
}
