import path from "node:path";
import { describe, expect, it } from "bun:test";
import { ContentHash } from "../../src/domain/ContentHash.js";
import { SnapshotPaths } from "../../src/snapshot/SnapshotPaths.js";

describe("SnapshotPaths", () => {
  it("derives deterministic object and blob paths", () => {
    const hash = ContentHash.parse(
      "sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    );

    expect(SnapshotPaths.relativeObjectPath(hash)).toBe(
      path.join("objects", "12", "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef.json"),
    );
    expect(SnapshotPaths.relativeBlobPath(hash)).toBe(
      path.join("blobs", "12", "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef.bin"),
    );
  });
});
