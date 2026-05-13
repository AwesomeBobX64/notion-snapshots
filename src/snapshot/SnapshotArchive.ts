import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as tar from "tar";

export interface ResolvedSnapshotWorkspace {
  rootPath: string;
  cleanup?: () => Promise<void>;
}

export class SnapshotArchive {
  public static isArchive(snapshotPath: string): boolean {
    return snapshotPath.endsWith(".tgz");
  }

  public static async compressDirectory(snapshotRoot: string, archivePath: string): Promise<void> {
    const parentDirectory = path.dirname(snapshotRoot);
    const rootName = path.basename(snapshotRoot);

    await tar.create(
      {
        gzip: true,
        cwd: parentDirectory,
        file: archivePath,
        portable: true,
      },
      [rootName],
    );
  }

  public static async resolveReadableWorkspace(snapshotPath: string): Promise<ResolvedSnapshotWorkspace> {
    if (!SnapshotArchive.isArchive(snapshotPath)) {
      return { rootPath: snapshotPath };
    }

    const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "notion-snapshots-"));

    await tar.extract({
      cwd: tempDirectory,
      file: snapshotPath,
      gzip: true,
    });

    const entries = await fs.readdir(tempDirectory, { withFileTypes: true });
    const rootEntry = entries.find((entry) => entry.isDirectory());

    if (!rootEntry) {
      throw new Error("Snapshot archive did not contain a root directory");
    }

    return {
      rootPath: path.join(tempDirectory, rootEntry.name),
      cleanup: async () => {
        await fs.rm(tempDirectory, { recursive: true, force: true });
      },
    };
  }
}
