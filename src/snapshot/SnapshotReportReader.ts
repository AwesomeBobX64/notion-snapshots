import fs from "node:fs/promises";
import path from "node:path";
import { SnapshotArchive } from "./SnapshotArchive.js";

export class SnapshotReportReader {
  public async read(snapshotPath: string): Promise<string> {
    const workspace = await SnapshotArchive.resolveReadableWorkspace(snapshotPath);

    try {
      const reports: string[] = [];

      for (const reportName of ["export-report.md", "import-report.md", "verify-report.md"]) {
        try {
          reports.push(
            await fs.readFile(path.join(workspace.rootPath, "reports", reportName), "utf8"),
          );
        } catch {
          // Ignore missing optional reports.
        }
      }

      if (reports.length === 0) {
        throw new Error(`No reports found in snapshot: ${workspace.rootPath}`);
      }

      return reports.join("\n\n");
    } finally {
      await workspace.cleanup?.();
    }
  }
}
