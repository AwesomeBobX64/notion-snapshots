import fs from "node:fs/promises";
import path from "node:path";
import { SnapshotPaths } from "../snapshot/SnapshotPaths.js";
import { FileSystem } from "../util/FileSystem.js";

export class SnapshotReportPersistence {
  public static async write(
    snapshotRoot: string,
    fileName: string,
    report: string,
  ): Promise<void> {
    const reportsDirectory = SnapshotPaths.reportsDirectory(snapshotRoot);
    await FileSystem.ensureDirectory(reportsDirectory);
    await fs.writeFile(path.join(reportsDirectory, fileName), report, "utf8");
  }
}
