import { SnapshotManifest } from "../domain/SnapshotManifest.js";
import { FileSystem } from "../util/FileSystem.js";
import { SnapshotPaths } from "../snapshot/SnapshotPaths.js";

export class ManifestRepository {
  public constructor(private readonly snapshotRoot: string) {}

  public async save(manifest: SnapshotManifest): Promise<void> {
    await FileSystem.writeJson(SnapshotPaths.manifestPath(this.snapshotRoot), manifest.toJSON());
  }

  public async load(): Promise<SnapshotManifest> {
    const manifestJson = await FileSystem.readJson<unknown>(SnapshotPaths.manifestPath(this.snapshotRoot));
    return SnapshotManifest.fromJSON(manifestJson);
  }
}
