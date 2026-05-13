import { ManifestRepository } from "../cas/ManifestRepository.js";
import { SnapshotArchive } from "./SnapshotArchive.js";

export class SnapshotInspector {
  public async inspect(snapshotPath: string): Promise<string> {
    const workspace = await SnapshotArchive.resolveReadableWorkspace(snapshotPath);

    try {
      const manifest = await new ManifestRepository(workspace.rootPath).load();
      const data = manifest.toJSON();

      return [
        `Snapshot: ${workspace.rootPath}`,
        `Status: ${data.status}`,
        `Snapshot ID: ${data.snapshot_id}`,
        `Root source: ${data.root.source_id}`,
        `Objects: ${data.counts.pages} pages, ${data.counts.blocks} blocks, ${data.counts.databases} databases`,
        `Files: ${data.counts.files}`,
        `Compressed: ${data.artifacts.compressed ? "yes" : "no"}`,
      ].join("\n");
    } finally {
      await workspace.cleanup?.();
    }
  }
}
