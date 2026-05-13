import { describe, expect, it } from "bun:test";
import { SnapshotManifest } from "../../src/domain/SnapshotManifest.js";

describe("SnapshotManifest", () => {
  it("creates a valid manifest with defaults", () => {
    const manifest = SnapshotManifest.create({
      sourceId: "notion://source/page/example",
      createdAt: "2026-05-13T07:00:00.000Z",
    });

    const json = manifest.toJSON();

    expect(json.tool).toBe("notion-snapshots");
    expect(json.status).toBe("running");
    expect(json.root.source_id).toBe("notion://source/page/example");
    expect(json.root.content_hash).toBeNull();
    expect(json.snapshot_id).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("updates artifact flags without changing stable snapshot identity", () => {
    const manifest = SnapshotManifest.create({
      sourceId: "notion://source/page/example",
      createdAt: "2026-05-13T07:00:00.000Z",
    });

    const next = manifest.markIndexCreated().markCompressed().withStatus("complete");

    expect(next.toJSON().artifacts).toEqual({
      has_index_sqlite: true,
      has_reports: false,
      compressed: true,
    });
    expect(next.status).toBe("complete");
    expect(next.snapshotId).toBe(manifest.snapshotId);
  });

  it("does not allow terminal manifests to return to running", () => {
    const manifest = SnapshotManifest.create({
      sourceId: "notion://source/page/example",
    }).withStatus("complete");

    expect(() => manifest.withStatus("running")).toThrow(
      "Cannot transition a finalized snapshot back to running",
    );
  });

  it("accepts legacy notion-clone manifests without rewriting the tool name", () => {
    const counts = {
      pages: 0,
      blocks: 0,
      databases: 0,
      rows: 0,
      files: 0,
      comments: 0,
      unsupported: 0,
      failures: 0,
    };
    const manifest = SnapshotManifest.fromJSON({
      tool: "notion-clone",
      schema_version: 1,
      created_at: "2026-05-13T07:00:00.000Z",
      snapshot_id: SnapshotManifest.computeSnapshotId(
        { source_id: "notion://source/page/example", content_hash: null },
        counts,
      ),
      root: {
        source_id: "notion://source/page/example",
        content_hash: null,
      },
      counts,
      artifacts: {
        has_index_sqlite: false,
        has_reports: false,
        compressed: false,
      },
      status: "complete",
    });

    expect(manifest.toJSON().tool).toBe("notion-clone");
  });

  it("preserves a legacy notion-clone tool when rebuilding the manifest", () => {
    const counts = {
      pages: 0,
      blocks: 0,
      databases: 0,
      rows: 0,
      files: 0,
      comments: 0,
      unsupported: 0,
      failures: 0,
    };
    const manifest = SnapshotManifest.fromJSON({
      tool: "notion-clone",
      schema_version: 1,
      created_at: "2026-05-13T07:00:00.000Z",
      snapshot_id: SnapshotManifest.computeSnapshotId(
        { source_id: "notion://source/page/example", content_hash: null },
        counts,
      ),
      root: {
        source_id: "notion://source/page/example",
        content_hash: null,
      },
      counts,
      artifacts: {
        has_index_sqlite: false,
        has_reports: false,
        compressed: false,
      },
      status: "running",
    });

    const rebuilt = manifest.markCompressed().withStatus("complete");

    expect(rebuilt.toJSON().tool).toBe("notion-clone");
  });
});
