import path from "node:path";
import type { ContentHash } from "../domain/ContentHash.js";

export class SnapshotPaths {
  public static manifestPath(snapshotRoot: string): string {
    return path.join(snapshotRoot, "manifest.json");
  }

  public static objectsDirectory(snapshotRoot: string): string {
    return path.join(snapshotRoot, "objects");
  }

  public static blobsDirectory(snapshotRoot: string): string {
    return path.join(snapshotRoot, "blobs");
  }

  public static indexesDirectory(snapshotRoot: string): string {
    return path.join(snapshotRoot, "indexes");
  }

  public static mappingsDirectory(snapshotRoot: string): string {
    return path.join(snapshotRoot, "mappings");
  }

  public static plansDirectory(snapshotRoot: string): string {
    return path.join(snapshotRoot, "plans");
  }

  public static reportsDirectory(snapshotRoot: string): string {
    return path.join(snapshotRoot, "reports");
  }

  public static runsDirectory(snapshotRoot: string): string {
    return path.join(snapshotRoot, "runs");
  }

  public static indexDatabasePath(snapshotRoot: string): string {
    return path.join(SnapshotPaths.indexesDirectory(snapshotRoot), "index.sqlite");
  }

  public static archivePath(snapshotRoot: string): string {
    return `${snapshotRoot}.tgz`;
  }

  public static relativeObjectPath(contentHash: ContentHash): string {
    return path.join("objects", contentHash.hex.slice(0, 2), `${contentHash.hex}.json`);
  }

  public static relativeBlobPath(blobHash: ContentHash): string {
    return path.join("blobs", blobHash.hex.slice(0, 2), `${blobHash.hex}.bin`);
  }

  public static objectPath(snapshotRoot: string, contentHash: ContentHash): string {
    return path.join(snapshotRoot, SnapshotPaths.relativeObjectPath(contentHash));
  }

  public static blobPath(snapshotRoot: string, blobHash: ContentHash): string {
    return path.join(snapshotRoot, SnapshotPaths.relativeBlobPath(blobHash));
  }

  public static requiredDirectories(snapshotRoot: string): string[] {
    return [
      snapshotRoot,
      SnapshotPaths.objectsDirectory(snapshotRoot),
      SnapshotPaths.blobsDirectory(snapshotRoot),
      SnapshotPaths.indexesDirectory(snapshotRoot),
      SnapshotPaths.plansDirectory(snapshotRoot),
      SnapshotPaths.mappingsDirectory(snapshotRoot),
      SnapshotPaths.runsDirectory(snapshotRoot),
      SnapshotPaths.reportsDirectory(snapshotRoot),
    ];
  }
}
