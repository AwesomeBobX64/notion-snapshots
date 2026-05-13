import { describe, expect, it } from "bun:test";
import { ContentHash } from "../../src/domain/ContentHash.js";
import { NotionFileFactory } from "../../src/graph/NotionFileFactory.js";
import { IMAGE_BLOCK_FIXTURE } from "../fixtures/notion/fileBlocks.fixture.js";

describe("NotionFileFactory", () => {
  it("builds a canonical notion.file_ref object from a file-backed block", () => {
    const blobHash = ContentHash.parse(
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );

    const fileRef = NotionFileFactory.createFileRef(
      IMAGE_BLOCK_FIXTURE,
      blobHash,
      "image/png",
      1234,
    );

    expect(fileRef.object_type).toBe("notion.file_ref");
    expect(fileRef.source.id).toBe("44444444-4444-4444-4444-444444444444");
    expect(fileRef.canonical.name).toBe("image.png");
    expect(fileRef.canonical.mime_type).toBe("image/png");
    expect(fileRef.canonical.size_bytes).toBe(1234);
    expect(fileRef.canonical.blob_ref).toBe(blobHash.toString());
    expect(fileRef.canonical.original_block_type).toBe("image");
  });
});
