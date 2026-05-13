import fs from "node:fs/promises";
import type { ContentHash } from "../domain/ContentHash.js";
import { FileSystem } from "../util/FileSystem.js";
import { SnapshotPaths } from "../snapshot/SnapshotPaths.js";

export class BlobStore {
  public constructor(private readonly snapshotRoot: string) {}

  public async put(blobHash: ContentHash, bytes: Uint8Array): Promise<string> {
    const blobPath = SnapshotPaths.blobPath(this.snapshotRoot, blobHash);

    await FileSystem.ensureParentDirectory(blobPath);

    try {
      await fs.access(blobPath);
    } catch {
      await fs.writeFile(blobPath, bytes);
    }

    return blobPath;
  }

  public async get(blobHash: ContentHash): Promise<Buffer> {
    return fs.readFile(SnapshotPaths.blobPath(this.snapshotRoot, blobHash));
  }

  public async has(blobHash: ContentHash): Promise<boolean> {
    try {
      await fs.access(SnapshotPaths.blobPath(this.snapshotRoot, blobHash));
      return true;
    } catch {
      return false;
    }
  }
}
