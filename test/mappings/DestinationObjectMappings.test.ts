import fs from "node:fs/promises";
import { afterEach, describe, expect, it } from "bun:test";
import { DestinationObjectMappings } from "../../src/mappings/DestinationObjectMappings.js";
import { SQLiteIndex } from "../../src/mappings/SQLiteIndex.js";
import { SnapshotPaths } from "../../src/snapshot/SnapshotPaths.js";
import { FileSystem } from "../../src/util/FileSystem.js";
import { createTempDir } from "../helpers/createTempDir.js";

describe("DestinationObjectMappings", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirectories.map((directory) => fs.rm(directory, { recursive: true, force: true })),
    );
    tempDirectories.length = 0;
  });

  it("records and resolves page, block, and database mappings by source object id", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-destination-mappings-");
    tempDirectories.push(snapshotRoot);

    await FileSystem.ensureDirectory(SnapshotPaths.indexesDirectory(snapshotRoot));
    const index = new SQLiteIndex(SnapshotPaths.indexDatabasePath(snapshotRoot));
    index.initialize();

    const mappings = new DestinationObjectMappings(index);
    mappings.recordPage("11111111-1111-1111-1111-111111111111", {
      destinationId: "dest-page",
      contentHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      status: "created_shell",
      createdAt: "2026-05-16T12:00:00.000Z",
    });
    mappings.recordBlock("22222222-2222-2222-2222-222222222222", {
      destinationId: "dest-block",
      contentHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      status: "replayed",
      createdAt: "2026-05-16T12:00:01.000Z",
    });
    mappings.recordDatabase("33333333-3333-3333-3333-333333333333", {
      destinationId: "dest-database",
      contentHash: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      status: "created_database",
      createdAt: "2026-05-16T12:00:02.000Z",
    });

    expect(mappings.pageIdFor("11111111-1111-1111-1111-111111111111")).toBe("dest-page");
    expect(mappings.blockIdFor("22222222-2222-2222-2222-222222222222")).toBe("dest-block");
    expect(mappings.databaseIdFor("33333333-3333-3333-3333-333333333333")).toBe("dest-database");
    expect(mappings.list().map((record) => record.source_id)).toEqual([
      "notion://source/block/22222222-2222-2222-2222-222222222222",
      "notion://source/database/33333333-3333-3333-3333-333333333333",
      "notion://source/page/11111111-1111-1111-1111-111111111111",
    ]);

    index.close();
  });
});
