import { BlobStore } from "../cas/BlobStore.js";
import { ObjectStore } from "../cas/ObjectStore.js";
import { DestinationObjectMappings } from "../mappings/DestinationObjectMappings.js";
import { SQLiteIndex } from "../mappings/SQLiteIndex.js";
import type { SnapshotLoader, LoadedSnapshot } from "./SnapshotLoader.js";
import { SnapshotPaths } from "./SnapshotPaths.js";

export interface SnapshotOperationSession {
  snapshot: LoadedSnapshot;
  objectStore: ObjectStore;
  blobStore: BlobStore;
  destinationMappings: DestinationObjectMappings;
}

export async function withSnapshotOperationSession<T>(
  options: {
    snapshotPath: string;
    snapshotLoader: SnapshotLoader;
  },
  run: (session: SnapshotOperationSession) => Promise<T>,
): Promise<T> {
  const snapshot = await options.snapshotLoader.load(options.snapshotPath);
  const objectStore = new ObjectStore(snapshot.snapshotRoot);
  const blobStore = new BlobStore(snapshot.snapshotRoot);
  const index = new SQLiteIndex(SnapshotPaths.indexDatabasePath(snapshot.snapshotRoot));
  index.initialize();

  try {
    return await run({
      snapshot,
      objectStore,
      blobStore,
      destinationMappings: new DestinationObjectMappings(index),
    });
  } finally {
    index.close();
    await snapshot.cleanup?.();
  }
}
