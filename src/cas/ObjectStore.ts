import fs from "node:fs/promises";
import { CanonicalJson } from "./CanonicalJson.js";
import { ContentHash } from "../domain/ContentHash.js";
import { FileSystem } from "../util/FileSystem.js";
import { SnapshotPaths } from "../snapshot/SnapshotPaths.js";

export interface StoredObjectRecord {
  content_hash: string;
  object_type: string;
}

export class ObjectStore {
  public constructor(private readonly snapshotRoot: string) {}

  public async put<T extends StoredObjectRecord>(record: T): Promise<{ hash: ContentHash; path: string }> {
    const hash = ContentHash.parse(record.content_hash);
    const objectPath = SnapshotPaths.objectPath(this.snapshotRoot, hash);
    const serialized = `${CanonicalJson.stringify(record)}\n`;

    await FileSystem.ensureParentDirectory(objectPath);

    try {
      await fs.access(objectPath);
    } catch {
      await fs.writeFile(objectPath, serialized, "utf8");
    }

    return { hash, path: objectPath };
  }

  public async get<T>(hash: ContentHash): Promise<T> {
    const objectPath = SnapshotPaths.objectPath(this.snapshotRoot, hash);
    const content = await fs.readFile(objectPath, "utf8");
    return JSON.parse(content) as T;
  }

  public async has(hash: ContentHash): Promise<boolean> {
    try {
      await fs.access(SnapshotPaths.objectPath(this.snapshotRoot, hash));
      return true;
    } catch {
      return false;
    }
  }
}
