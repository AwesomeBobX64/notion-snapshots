import fs from "node:fs/promises";
import { afterEach, describe, expect, it } from "bun:test";
import { SQLiteIndex } from "../../src/mappings/SQLiteIndex.js";
import { SnapshotPaths } from "../../src/snapshot/SnapshotPaths.js";
import { FileSystem } from "../../src/util/FileSystem.js";
import { createTempDir } from "../helpers/createTempDir.js";

describe("SQLiteIndex", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirectories.map((directory) => fs.rm(directory, { recursive: true, force: true })));
    tempDirectories.length = 0;
  });

  it("creates schema and stores source/object/blob records", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-index-");
    tempDirectories.push(snapshotRoot);

    await FileSystem.ensureDirectory(SnapshotPaths.indexesDirectory(snapshotRoot));
    const index = new SQLiteIndex(SnapshotPaths.indexDatabasePath(snapshotRoot));
    index.initialize();

    index.upsertSourceObject({
      source_id: "source-1",
      object_type: "notion.page",
      content_hash: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
      raw_hash: null,
      status: "stored",
      created_at: "2026-05-13T07:00:00.000Z",
    });

    index.upsertObjectStore({
      content_hash: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
      object_type: "notion.page",
      path: "objects/11/hash.json",
      size_bytes: 128,
      created_at: "2026-05-13T07:00:00.000Z",
    });

    index.upsertBlobStore({
      blob_hash: "sha256:2222222222222222222222222222222222222222222222222222222222222222",
      path: "blobs/22/hash.bin",
      size_bytes: 64,
      mime_type: "text/plain",
      created_at: "2026-05-13T07:00:00.000Z",
    });

    expect(index.getSourceObject("source-1")?.content_hash).toBe(
      "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    );
    expect(index.getObjectStore("sha256:1111111111111111111111111111111111111111111111111111111111111111")?.path).toBe(
      "objects/11/hash.json",
    );
    expect(index.getBlobStore("sha256:2222222222222222222222222222222222222222222222222222222222222222")?.mime_type).toBe(
      "text/plain",
    );

    index.close();
  });

  it("upserts and lists destination objects", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-index-destination-");
    tempDirectories.push(snapshotRoot);

    await FileSystem.ensureDirectory(SnapshotPaths.indexesDirectory(snapshotRoot));
    const index = new SQLiteIndex(SnapshotPaths.indexDatabasePath(snapshotRoot));
    index.initialize();

    index.upsertDestinationObject({
      source_id: "page-2",
      destination_id: "destination-b",
      object_type: "notion.page",
      content_hash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      status: "created_shell",
      created_at: "2026-05-13T07:00:00.000Z",
    });
    index.upsertDestinationObject({
      source_id: "page-1",
      destination_id: "destination-a",
      object_type: "notion.page",
      content_hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      status: "created_shell",
      created_at: "2026-05-13T07:00:00.000Z",
    });
    index.upsertDestinationObject({
      source_id: "page-2",
      destination_id: "destination-b-updated",
      object_type: "notion.page",
      content_hash: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      status: "replayed",
      created_at: "2026-05-13T08:00:00.000Z",
    });

    expect(index.getDestinationObject("page-2")).toEqual({
      source_id: "page-2",
      destination_id: "destination-b-updated",
      object_type: "notion.page",
      content_hash: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      status: "replayed",
      created_at: "2026-05-13T08:00:00.000Z",
    });
    expect(index.listDestinationObjects().map((record) => record.source_id)).toEqual([
      "page-1",
      "page-2",
    ]);

    index.close();
  });
});
