import fs from "node:fs/promises";
import { afterEach, describe, expect, it } from "bun:test";
import { ObjectStore } from "../../src/cas/ObjectStore.js";
import { Sha256 } from "../../src/cas/Sha256.js";
import { ContentHash } from "../../src/domain/ContentHash.js";
import { SnapshotPaths } from "../../src/snapshot/SnapshotPaths.js";
import { createTempDir } from "../helpers/createTempDir.js";

describe("ObjectStore", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirectories.map((directory) => fs.rm(directory, { recursive: true, force: true })));
    tempDirectories.length = 0;
  });

  it("writes and reads content-addressed objects idempotently", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-object-store-");
    tempDirectories.push(snapshotRoot);

    const store = new ObjectStore(snapshotRoot);
    const record = {
      object_type: "notion.page",
      schema_version: 1,
      content_hash: Sha256.hashCanonicalJson({
        object_type: "notion.page",
        schema_version: 1,
        canonical: { title: [] },
      }).toString(),
      canonical: {
        title: [],
      },
    };

    const first = await store.put(record);
    const second = await store.put(record);

    expect(first.path).toBe(second.path);
    expect(await store.has(ContentHash.parse(record.content_hash))).toBe(true);
    expect(await store.get<typeof record>(ContentHash.parse(record.content_hash))).toEqual(record);
    expect(first.path).toBe(
      SnapshotPaths.objectPath(snapshotRoot, ContentHash.parse(record.content_hash)),
    );
  });
});
