import fs from "node:fs/promises";
import { afterEach, describe, expect, it } from "bun:test";
import { ObjectStore } from "../../src/cas/ObjectStore.js";
import { Sha256 } from "../../src/cas/Sha256.js";
import { SnapshotVerifyBlockNormalizer } from "../../src/verify/SnapshotVerifyBlockNormalizer.js";
import type { LoadedCanonicalBlock } from "../../src/snapshot/SnapshotLoader.js";
import { createTempDir } from "../helpers/createTempDir.js";

describe("SnapshotVerifyBlockNormalizer", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirectories.map((directory) => fs.rm(directory, { recursive: true, force: true })));
    tempDirectories.length = 0;
  });

  it("normalizes callout payloads with comparable rich text and icon values", () => {
    expect(
      SnapshotVerifyBlockNormalizer.actualPayload("callout", {
        callout: {
          rich_text: [
            {
              text: {
                content: "Heads up",
              },
            },
          ],
          color: "",
          icon: {
            type: "emoji",
            emoji: "💡",
          },
          ignored: true,
        },
      }),
    ).toEqual({
      rich_text: [
        {
          plain_text: "Heads up",
          annotations: {
            bold: false,
            italic: false,
            strikethrough: false,
            underline: false,
            code: false,
            color: "default",
          },
        },
      ],
      color: "default",
      icon: {
        type: "emoji",
        emoji: "💡",
      },
    });
  });

  it("normalizes table row cells as comparable rich-text arrays", () => {
    expect(
      SnapshotVerifyBlockNormalizer.actualPayload("table_row", {
        table_row: {
          cells: [
            [
              {
                plain_text: "A1",
              },
            ],
            [
              {
                text: {
                  content: "B1",
                },
                annotations: {
                  underline: true,
                },
              },
            ],
            null,
          ],
        },
      }),
    ).toEqual({
      cells: [
        [
          {
            plain_text: "A1",
            annotations: {
              bold: false,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false,
              color: "default",
            },
          },
        ],
        [
          {
            plain_text: "B1",
            annotations: {
              bold: false,
              italic: false,
              strikethrough: false,
              underline: true,
              code: false,
              color: "default",
            },
          },
        ],
        [],
      ],
    });
  });

  it("normalizes toggle heading payloads including is_toggleable", () => {
    expect(
      SnapshotVerifyBlockNormalizer.actualPayload("heading_2", {
        heading_2: {
          rich_text: [
            {
              text: {
                content: "Expandable heading",
              },
            },
          ],
          color: "",
          is_toggleable: true,
        },
      }),
    ).toEqual({
      rich_text: [
        {
          plain_text: "Expandable heading",
          annotations: {
            bold: false,
            italic: false,
            strikethrough: false,
            underline: false,
            code: false,
            color: "default",
          },
        },
      ],
      color: "default",
      is_toggleable: true,
    });
  });

  it("resolves expected file payload names from canonical file refs", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-verify-block-normalizer-");
    tempDirectories.push(snapshotRoot);

    const objectStore = new ObjectStore(snapshotRoot);
    const fileRef = {
      object_type: "notion.file",
      content_hash: Sha256.hashCanonicalJson({
        object_type: "notion.file",
        canonical: {
          name: "spec.pdf",
        },
      }).toString(),
      canonical: {
        name: "spec.pdf",
      },
    };
    await objectStore.put(fileRef);

    const block: LoadedCanonicalBlock = {
      object_type: "notion.block",
      content_hash: Sha256.hashCanonicalJson({
        object_type: "notion.block",
        source: {
          id: "block-1",
        },
        canonical: {
          block_type: "file",
          payload: {
            caption: [],
            file_ref: fileRef.content_hash,
          },
          children_ref: null,
        },
      }).toString(),
      source: {
        id: "block-1",
      },
      canonical: {
        block_type: "file",
        payload: {
          caption: [],
          file_ref: fileRef.content_hash,
        },
        children_ref: null,
      },
    };

    expect(await SnapshotVerifyBlockNormalizer.expectedPayload(block, objectStore)).toEqual({
      caption: [],
      name: "spec.pdf",
    });
  });
});
