import fs from "node:fs/promises";
import { afterEach, describe, expect, it } from "bun:test";
import { SnapshotLoader } from "../../src/snapshot/SnapshotLoader.js";
import {
  createPageTreeSnapshot,
  createRootDatabaseSnapshot,
} from "../fixtures/import/importSnapshot.fixture.js";
import { createTempDir } from "../helpers/createTempDir.js";

describe("SnapshotLoader", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirectories.map((directory) => fs.rm(directory, { recursive: true, force: true })));
    tempDirectories.length = 0;
  });

  it("loads a page-root snapshot and resolves child page hierarchy", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-import-loader-");
    tempDirectories.push(snapshotRoot);
    await createPageTreeSnapshot(snapshotRoot);

    const snapshot = await new SnapshotLoader().load(snapshotRoot);

    expect(snapshot.manifest.root.source_id).toBe(
      "notion://source/page/01234567-89ab-cdef-0123-456789abcdef",
    );
    expect(snapshot.rootPage?.source.id).toBe("01234567-89ab-cdef-0123-456789abcdef");
    expect(snapshot.pages).toHaveLength(2);
    expect(snapshot.pageChildren.get("01234567-89ab-cdef-0123-456789abcdef")).toEqual([
      "77777777-7777-7777-7777-777777777777",
    ]);
  });

  it("loads a database-root snapshot without requiring a root page", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-import-loader-database-");
    tempDirectories.push(snapshotRoot);
    await createRootDatabaseSnapshot(snapshotRoot);

    const snapshot = await new SnapshotLoader().load(snapshotRoot);

    expect(snapshot.manifest.root.source_id).toBe(
      "notion://source/database/99999999-9999-9999-9999-999999999999",
    );
    expect(snapshot.rootDatabase?.source.id).toBe("99999999-9999-9999-9999-999999999999");
    expect(snapshot.rootPage).toBeNull();
    expect(snapshot.pages).toEqual([]);
  });
});
