export interface VerifyReportSummary {
  targetPageId: string;
  verifiedPages: number;
  verifiedBlocks: number;
  verifiedDatabases: number;
  transformedObjects: number;
  failures: number;
  failureDetails?: VerifyReportFailureDetail[];
}

export interface VerifyReportFailureDetail {
  objectType: string;
  sourceId: string;
  destinationId?: string;
  message: string;
  expected?: unknown;
  actual?: unknown;
}

export class VerifyReportWriter {
  public static render(summary: VerifyReportSummary): string {
    const lines = [
      "# Verify Report",
      "",
      "## Summary",
      "",
      `- Target page: \`${summary.targetPageId}\``,
      `- Pages verified: ${summary.verifiedPages}`,
      `- Blocks verified: ${summary.verifiedBlocks}`,
      `- Databases verified: ${summary.verifiedDatabases}`,
      `- Transformed objects confirmed: ${summary.transformedObjects}`,
      `- Failures: ${summary.failures}`,
      "",
    ];

    if ((summary.failureDetails?.length ?? 0) > 0) {
      lines.push("## Failure Details", "");

      for (const failure of summary.failureDetails ?? []) {
        const destinationSuffix = failure.destinationId
          ? ` -> destination \`${failure.destinationId}\``
          : "";
        lines.push(
          `- [${failure.objectType}] source \`${failure.sourceId}\`${destinationSuffix}: ${failure.message}`,
        );

        if (failure.expected !== undefined) {
          lines.push(`  Expected: \`${VerifyReportWriter.serializeValue(failure.expected)}\``);
        }

        if (failure.actual !== undefined) {
          lines.push(`  Actual: \`${VerifyReportWriter.serializeValue(failure.actual)}\``);
        }
      }

      lines.push("");
    }

    return lines.join("\n");
  }

  private static serializeValue(value: unknown): string {
    return JSON.stringify(value);
  }
}
