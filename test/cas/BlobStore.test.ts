import fs from "node:fs/promises";
import { afterEach, describe, expect, it } from "bun:test";
import { BlobStore } from "../../src/cas/BlobStore.js";
import { Sha256 } from "../../src/cas/Sha256.js";
import { createTempDir } from "../helpers/createTempDir.js";

describe("BlobStore", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirectories.map((directory) => fs.rm(directory, { recursive: true, force: true })));
    tempDirectories.length = 0;
  });

  it("writes and reads content-addressed blobs idempotently", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-blob-store-");
    tempDirectories.push(snapshotRoot);

    const store = new BlobStore(snapshotRoot);
    const bytes = Buffer.from("hello snapshot");
    const hash = Sha256.hashBytes(bytes);

    const firstPath = await store.put(hash, bytes);
    const secondPath = await store.put(hash, bytes);

    expect(firstPath).toBe(secondPath);
    expect(await store.has(hash)).toBe(true);
    expect((await store.get(hash)).equals(bytes)).toBe(true);
  });
});
