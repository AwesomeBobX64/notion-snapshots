import fs from "node:fs/promises";
import { afterEach, describe, expect, it } from "bun:test";
import { ImportWorkflow } from "../../src/import/ImportWorkflow.js";
import { SnapshotWorkflow } from "../../src/export/SnapshotWorkflow.js";
import { SnapshotVerifier } from "../../src/verify/SnapshotVerifier.js";
import type { DestinationBlockWriter } from "../../src/notion/DestinationBlockWriter.js";
import type { DestinationDatabaseWriter } from "../../src/notion/DestinationDatabaseWriter.js";
import type { DestinationFileUploader } from "../../src/notion/DestinationFileUploader.js";
import type {
  CreatePageShellInput,
  DestinationPageWriter,
} from "../../src/notion/DestinationPageWriter.js";
import { SnapshotPaths } from "../../src/snapshot/SnapshotPaths.js";
import {
  createDatabaseReplaySnapshot,
  createReplayablePageTreeSnapshot,
} from "../fixtures/import/importSnapshot.fixture.js";
import {
  ROOT_PAGE_BLOCKS_FIXTURE,
  TOGGLE_CHILD_BLOCKS_FIXTURE,
} from "../fixtures/notion/blocks.fixture.js";
import {
  CHILD_PAGE_BLOCKS_FIXTURE,
  CHILD_PAGE_FIXTURE,
} from "../fixtures/notion/childPage.fixture.js";
import {
  DATABASE_FIXTURE,
  DATABASE_ROW_BLOCKS_FIXTURE,
  DATABASE_ROW_PAGE_FIXTURE,
  DATA_SOURCE_FIXTURE,
} from "../fixtures/notion/database.fixture.js";
import { ROOT_PAGE_FIXTURE } from "../fixtures/notion/rootPage.fixture.js";
import { createTempDir } from "../helpers/createTempDir.js";

const REPLAYABLE_TREE_PAGE_SHELL_IDS: Record<string, string> = {
  "Root Page": "dest-root-page",
  "Nested Child Page": "dest-child-page",
};

const REPLAYABLE_TREE_BLOCK_IDS: Record<string, string> = {
  "dest-root-page::paragraph::Intro paragraph": "dest-root-paragraph",
  "dest-root-page::toggle::Details": "dest-root-toggle",
  "dest-root-toggle::to_do::Nested task": "dest-toggle-todo",
  "dest-child-page::paragraph::Nested page paragraph": "dest-child-paragraph",
};

function richTextBlockTypeAndText(block: Record<string, unknown>): { type: string; text: string } {
  const type = String(block.type);
  const payload = block[type] as Record<string, unknown>;
  const richText = Array.isArray(payload.rich_text)
    ? (payload.rich_text as { text?: { content?: string } }[]).map((item) => item.text?.content ?? "")
    : [];
  return { type, text: richText.join("") };
}

function replayableTreePageShellId(title: string): string {
  const destinationId = REPLAYABLE_TREE_PAGE_SHELL_IDS[title];
  if (destinationId) {
    return destinationId;
  }

  throw new Error(`Unexpected page shell input title: ${title}`);
}

function replayableTreeBlockId(parentId: string, type: string, text: string): string {
  const destinationId = REPLAYABLE_TREE_BLOCK_IDS[`${parentId}::${type}::${text}`];
  if (destinationId) {
    return destinationId;
  }

  throw new Error(`Unexpected block append input: ${JSON.stringify({ parentId, type, text })}`);
}

function replayableTreeVerifyBlock(blockId: string): Record<string, unknown> {
  const blocks: Record<string, Record<string, unknown>> = {
    "dest-root-paragraph": {
      ...ROOT_PAGE_BLOCKS_FIXTURE[0],
      id: blockId,
    },
    "dest-root-toggle": {
      ...ROOT_PAGE_BLOCKS_FIXTURE[1],
      id: blockId,
    },
    "dest-toggle-todo": {
      ...TOGGLE_CHILD_BLOCKS_FIXTURE[0],
      id: blockId,
    },
    "dest-child-paragraph": {
      ...CHILD_PAGE_BLOCKS_FIXTURE[0],
      id: blockId,
    },
  };

  if (!blocks[blockId]) {
    throw new Error(`Unexpected block verify read: ${blockId}`);
  }

  return blocks[blockId];
}

class ReplayableTreePageWriter implements DestinationPageWriter {
  public async createPageShell(input: CreatePageShellInput): Promise<string> {
    return replayableTreePageShellId(input.title);
  }
}

class ReplayableTreeBlockWriter implements DestinationBlockWriter {
  public async appendBlock(input: {
    parentId: string;
    block: Record<string, unknown>;
  }): Promise<string> {
    const { type, text } = richTextBlockTypeAndText(input.block);
    return replayableTreeBlockId(input.parentId, type, text);
  }
}

describe("SnapshotVerifier", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirectories.map((directory) => fs.rm(directory, { recursive: true, force: true })));
    tempDirectories.length = 0;
  });

  it("verifies supported block payloads and child-page transforms against the imported snapshot", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-verify-");
    tempDirectories.push(snapshotRoot);
    await createReplayablePageTreeSnapshot(snapshotRoot);

    await new ImportWorkflow(
      new ReplayableTreePageWriter(),
      new ReplayableTreeBlockWriter(),
    ).run({
      snapshotPath: snapshotRoot,
      targetPageId: "99999999-9999-9999-9999-999999999999",
      clock: () => "2026-05-13T08:00:00.000Z",
    });

    const result = await new SnapshotVerifier(
      {
        fetchPage: async (pageId: string) => {
          if (pageId === "99999999-9999-9999-9999-999999999999") {
            return ROOT_PAGE_FIXTURE;
          }

          if (pageId === "dest-root-page") {
            return ROOT_PAGE_FIXTURE;
          }

          if (pageId === "dest-child-page") {
            return CHILD_PAGE_FIXTURE;
          }

          throw new Error(`Unexpected page verify read: ${pageId}`);
        },
      },
      {
        fetchBlock: async (blockId: string) => replayableTreeVerifyBlock(blockId),
      },
      {
        fetchDatabase: async () => {
          throw new Error("unexpected database verify read");
        },
        fetchDataSource: async () => {
          throw new Error("unexpected data source verify read");
        },
      },
    ).run({
      snapshotPath: snapshotRoot,
      targetPageId: "99999999-9999-9999-9999-999999999999",
    });

    expect(result.verifiedPages).toBe(2);
    expect(result.verifiedBlocks).toBe(4);
    expect(result.verifiedDatabases).toBe(0);
    expect(result.transformedObjects).toBe(1);
    expect(result.failures).toBe(0);

    expect(
      await fs.readFile(`${SnapshotPaths.reportsDirectory(snapshotRoot)}/verify-report.md`, "utf8"),
    ).toContain("# Verify Report");
  });

  it("reports page property mismatches instead of title-only success", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-verify-page-properties-");
    tempDirectories.push(snapshotRoot);
    await createReplayablePageTreeSnapshot(snapshotRoot);

    await new ImportWorkflow(
      new ReplayableTreePageWriter(),
      new ReplayableTreeBlockWriter(),
    ).run({
      snapshotPath: snapshotRoot,
      targetPageId: "99999999-9999-9999-9999-999999999999",
      clock: () => "2026-05-13T08:00:00.000Z",
    });

    const result = await new SnapshotVerifier(
      {
        fetchPage: async (pageId: string) => {
          if (pageId === "99999999-9999-9999-9999-999999999999") {
            return ROOT_PAGE_FIXTURE;
          }

          if (pageId === "dest-root-page") {
            return {
              ...ROOT_PAGE_FIXTURE,
              properties: {
                ...ROOT_PAGE_FIXTURE.properties,
                Status: {
                  ...ROOT_PAGE_FIXTURE.properties.Status,
                  status: {
                    id: "done",
                    name: "Done",
                    color: "green",
                  },
                },
              },
            };
          }

          if (pageId === "dest-child-page") {
            return CHILD_PAGE_FIXTURE;
          }

          throw new Error(`Unexpected page verify read: ${pageId}`);
        },
      },
      {
        fetchBlock: async (blockId: string) => replayableTreeVerifyBlock(blockId),
      },
      {
        fetchDatabase: async () => {
          throw new Error("unexpected database verify read");
        },
        fetchDataSource: async () => {
          throw new Error("unexpected data source verify read");
        },
      },
    ).run({
      snapshotPath: snapshotRoot,
      targetPageId: "99999999-9999-9999-9999-999999999999",
    });

    expect(result.failures).toBe(1);
    expect(
      await fs.readFile(`${SnapshotPaths.reportsDirectory(snapshotRoot)}/verify-report.md`, "utf8"),
    ).toContain("Page properties mismatch");
  });

  it("verifies transformed child databases and row properties against the imported snapshot", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-verify-database-");
    tempDirectories.push(snapshotRoot);
    await createDatabaseReplaySnapshot(snapshotRoot);

    class FakeDestinationPageWriter implements DestinationPageWriter {
      public async createPageShell(input: CreatePageShellInput): Promise<string> {
        expect(input.title).toBe("Root Page");
        expect(input.properties).toHaveProperty("Status");
        expect(input.icon).toEqual({
          type: "emoji",
          emoji: "📘",
        });
        expect(input.cover).toEqual({
          type: "external",
          external: {
            url: "https://example.com/root-cover.png",
          },
        });
        return "dest-root-page";
      }
    }

    class FakeDestinationBlockWriter implements DestinationBlockWriter {
      public async appendBlock(input: {
        parentId: string;
        block: Record<string, unknown>;
      }): Promise<string> {
        const type = String(input.block.type);
        const payload = (input.block)[type] as Record<string, unknown>;
        const richText = Array.isArray(payload.rich_text)
          ? (payload.rich_text as { text?: { content?: string } }[]).map(
              (item) => item.text?.content ?? "",
            )
          : [];
        const text = richText.join("");

        if (input.parentId === "dest-row-page" && type === "paragraph" && text === "Row details") {
          return "dest-row-paragraph";
        }

        throw new Error(`Unexpected block append input: ${JSON.stringify(input)}`);
      }
    }

    class FakeDestinationDatabaseWriter implements DestinationDatabaseWriter {
      public async createInlineDatabase(input: {
        parentPageId: string;
        title: string;
        description: { text?: { content?: string } }[];
        properties: Record<string, unknown>;
      }): Promise<{ databaseId: string; dataSourceId: string }> {
        expect(input.parentPageId).toBe("dest-root-page");
        expect(input.title).toBe("Tasks Database");
        expect(input.description.map((segment) => segment.text?.content ?? "").join("")).toBe(
          "Imported tasks database",
        );
        expect(input.properties).toHaveProperty("Name");
        expect(input.properties).toHaveProperty("Status");
        expect(input.properties).toHaveProperty("Tags");
        expect(input.properties).toHaveProperty("Assignee");
        expect(input.properties).toHaveProperty("Ticket");
        return {
          databaseId: "dest-database",
          dataSourceId: "dest-data-source",
        };
      }

      public async createRowPage(input: {
        dataSourceId: string;
        properties: Record<string, unknown>;
      }): Promise<string> {
        expect(input.dataSourceId).toBe("dest-data-source");
        expect(input.properties).toHaveProperty("Name");
        expect(input.properties).toHaveProperty("Status");
        expect(input.properties).toHaveProperty("Tags");
        expect(input.properties).toHaveProperty("Assignee");
        return "dest-row-page";
      }
    }

    await new ImportWorkflow(
      new FakeDestinationPageWriter(),
      new FakeDestinationBlockWriter(),
      {
        databaseWriter: new FakeDestinationDatabaseWriter(),
      },
    ).run({
      snapshotPath: snapshotRoot,
      targetPageId: "99999999-9999-9999-9999-999999999999",
      clock: () => "2026-05-13T08:00:00.000Z",
    });

    const result = await new SnapshotVerifier(
      {
        fetchPage: async (pageId: string) => {
          if (pageId === "99999999-9999-9999-9999-999999999999") {
            return ROOT_PAGE_FIXTURE;
          }

          if (pageId === "dest-root-page") {
            return ROOT_PAGE_FIXTURE;
          }

          if (pageId === "dest-row-page") {
            return DATABASE_ROW_PAGE_FIXTURE;
          }

          throw new Error(`Unexpected page verify read: ${pageId}`);
        },
      },
      {
        fetchBlock: async (blockId: string) => {
          if (blockId === "dest-row-paragraph") {
            return {
              ...DATABASE_ROW_BLOCKS_FIXTURE[0],
              id: blockId,
            };
          }

          throw new Error(`Unexpected block verify read: ${blockId}`);
        },
      },
      {
        fetchDatabase: async (databaseId: string) => {
          if (databaseId === "dest-database") {
            return {
              ...DATABASE_FIXTURE,
              id: databaseId,
              data_sources: [
                {
                  id: "dest-data-source",
                  name: "Tasks",
                },
              ],
            };
          }

          throw new Error(`Unexpected database verify read: ${databaseId}`);
        },
        fetchDataSource: async (dataSourceId: string) => {
          if (dataSourceId === "dest-data-source") {
            return {
              ...DATA_SOURCE_FIXTURE,
              id: dataSourceId,
              parent: {
                type: "database_id",
                database_id: "dest-database",
              },
            };
          }

          throw new Error(`Unexpected data source verify read: ${dataSourceId}`);
        },
      },
    ).run({
      snapshotPath: snapshotRoot,
      targetPageId: "99999999-9999-9999-9999-999999999999",
    });

    expect(result.verifiedPages).toBe(2);
    expect(result.verifiedBlocks).toBe(1);
    expect(result.verifiedDatabases).toBe(1);
    expect(result.transformedObjects).toBe(1);
    expect(result.failures).toBe(0);

    expect(
      await fs.readFile(`${SnapshotPaths.reportsDirectory(snapshotRoot)}/verify-report.md`, "utf8"),
    ).toContain("- Transformed objects confirmed: 1");
  });

  it("verifies uploaded page file assets and files properties after import", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-verify-page-file-assets-");
    tempDirectories.push(snapshotRoot);

    const pageWithFileAssets = {
      ...ROOT_PAGE_FIXTURE,
      icon: {
        type: "file",
        file: {
          url: "https://files.notion.test/page-icon.png",
          expiry_time: "2026-05-13T08:00:00.000Z",
        },
      },
      cover: {
        type: "file",
        file: {
          url: "https://files.notion.test/page-cover.png",
          expiry_time: "2026-05-13T08:00:00.000Z",
        },
      },
      properties: {
        ...ROOT_PAGE_FIXTURE.properties,
        Attachments: {
          id: "attachments",
          type: "files",
          files: [
            {
              type: "file",
              name: "spec.pdf",
              file: {
                url: "https://files.notion.test/spec.pdf",
                expiry_time: "2026-05-13T08:00:00.000Z",
              },
            },
          ],
        },
      },
    };

    class FakeNotionPageReader {
      public async fetchPage(): Promise<Record<string, unknown>> {
        return pageWithFileAssets;
      }
    }

    class FakeNotionBlockReader {
      public async fetchBlockChildren(): Promise<readonly Record<string, unknown>[]> {
        return [];
      }
    }

    await new SnapshotWorkflow(
      new FakeNotionPageReader(),
      new FakeNotionBlockReader(),
      {
        download: async (url: string) => ({
          bytes: Buffer.from(`bytes:${url}`),
          mimeType: url.endsWith(".pdf") ? "application/pdf" : "image/png",
        }),
      },
      {
        fetchDatabase: async () => {
          throw new Error("unexpected database fetch");
        },
        fetchDataSource: async () => {
          throw new Error("unexpected data source fetch");
        },
        queryRows: async () => {
          throw new Error("unexpected row query");
        },
      },
    ).run({
      sourcePage: "0123456789abcdef0123456789abcdef",
      token: "secret_token",
      snapshotRoot,
      compress: false,
      clock: () => "2026-05-13T07:00:00.000Z",
    });

    class FakeDestinationPageWriter implements DestinationPageWriter {
      public async createPageShell(input: CreatePageShellInput): Promise<string> {
        expect(input.icon).toEqual({
          type: "file_upload",
          file_upload: {
            id: "upload-page-icon.png",
          },
        });
        expect(input.cover).toEqual({
          type: "file_upload",
          file_upload: {
            id: "upload-page-cover.png",
          },
        });
        expect(input.properties?.Attachments).toEqual({
          files: [
            {
              type: "file_upload",
              name: "spec.pdf",
              file_upload: {
                id: "upload-spec.pdf",
              },
            },
          ],
        });
        return "dest-root-page";
      }
    }

    class NoOpDestinationBlockWriter implements DestinationBlockWriter {
      public async appendBlock(): Promise<string> {
        throw new Error("unexpected block append");
      }
    }

    class FakeDestinationFileUploader implements DestinationFileUploader {
      public async uploadFile(input: {
        filename: string;
        mimeType: string;
        bytes: Uint8Array;
      }): Promise<string> {
        expect(Buffer.from(input.bytes).toString("utf8")).toContain("bytes:https://files.notion.test/");
        return `upload-${input.filename}`;
      }
    }

    const importResult = await new ImportWorkflow(
      new FakeDestinationPageWriter(),
      new NoOpDestinationBlockWriter(),
      {
        fileUploader: new FakeDestinationFileUploader(),
      },
    ).run({
      snapshotPath: snapshotRoot,
      targetPageId: "99999999-9999-9999-9999-999999999999",
      clock: () => "2026-05-13T08:00:00.000Z",
    });

    expect(importResult.uploadedFiles).toBe(3);

    const result = await new SnapshotVerifier(
      {
        fetchPage: async (pageId: string) => {
          if (pageId === "99999999-9999-9999-9999-999999999999") {
            return ROOT_PAGE_FIXTURE;
          }

          if (pageId === "dest-root-page") {
            return {
              ...pageWithFileAssets,
              icon: {
                type: "file",
                file: {
                  url: "https://files.notion.test/destination-page-icon.png",
                  expiry_time: "2026-05-13T09:00:00.000Z",
                },
              },
              cover: {
                type: "file",
                file: {
                  url: "https://files.notion.test/destination-page-cover.png",
                  expiry_time: "2026-05-13T09:00:00.000Z",
                },
              },
              properties: {
                ...pageWithFileAssets.properties,
                Attachments: {
                  id: "attachments",
                  type: "files",
                  files: [
                    {
                      type: "file",
                      name: "spec.pdf",
                      file: {
                        url: "https://files.notion.test/destination-spec.pdf",
                        expiry_time: "2026-05-13T09:00:00.000Z",
                      },
                    },
                  ],
                },
              },
            };
          }

          throw new Error(`Unexpected page verify read: ${pageId}`);
        },
      },
      {
        fetchBlock: async () => {
          throw new Error("unexpected block verify read");
        },
      },
      {
        fetchDatabase: async () => {
          throw new Error("unexpected database verify read");
        },
        fetchDataSource: async () => {
          throw new Error("unexpected data source verify read");
        },
      },
    ).run({
      snapshotPath: snapshotRoot,
      targetPageId: "99999999-9999-9999-9999-999999999999",
    });

    expect(result.verifiedPages).toBe(1);
    expect(result.failures).toBe(0);
  });

  it("reports detailed block payload mismatches", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-verify-failures-");
    tempDirectories.push(snapshotRoot);
    await createReplayablePageTreeSnapshot(snapshotRoot);

    await new ImportWorkflow(
      new ReplayableTreePageWriter(),
      new ReplayableTreeBlockWriter(),
    ).run({
      snapshotPath: snapshotRoot,
      targetPageId: "99999999-9999-9999-9999-999999999999",
      clock: () => "2026-05-13T08:00:00.000Z",
    });

    const result = await new SnapshotVerifier(
      {
        fetchPage: async (pageId: string) => {
          if (pageId === "99999999-9999-9999-9999-999999999999") {
            return ROOT_PAGE_FIXTURE;
          }

          if (pageId === "dest-root-page") {
            return ROOT_PAGE_FIXTURE;
          }

          if (pageId === "dest-child-page") {
            return CHILD_PAGE_FIXTURE;
          }

          throw new Error(`Unexpected page verify read: ${pageId}`);
        },
      },
      {
        fetchBlock: async (blockId: string) => {
          if (blockId === "dest-root-paragraph") {
            return {
              ...ROOT_PAGE_BLOCKS_FIXTURE[0],
              id: blockId,
            };
          }

          if (blockId === "dest-root-toggle") {
            return {
              ...ROOT_PAGE_BLOCKS_FIXTURE[1],
              id: blockId,
            };
          }

          if (blockId === "dest-toggle-todo") {
            return {
              ...TOGGLE_CHILD_BLOCKS_FIXTURE[0],
              id: blockId,
              to_do: {
                ...TOGGLE_CHILD_BLOCKS_FIXTURE[0].to_do,
                checked: false,
              },
            };
          }

          if (blockId === "dest-child-paragraph") {
            return {
              ...CHILD_PAGE_BLOCKS_FIXTURE[0],
              id: blockId,
            };
          }

          throw new Error(`Unexpected block verify read: ${blockId}`);
        },
      },
      {
        fetchDatabase: async () => {
          throw new Error("unexpected database verify read");
        },
        fetchDataSource: async () => {
          throw new Error("unexpected data source verify read");
        },
      },
    ).run({
      snapshotPath: snapshotRoot,
      targetPageId: "99999999-9999-9999-9999-999999999999",
    });

    expect(result.verifiedPages).toBe(2);
    expect(result.verifiedBlocks).toBe(3);
    expect(result.verifiedDatabases).toBe(0);
    expect(result.transformedObjects).toBe(1);
    expect(result.failures).toBe(1);

    const verifyReport = await fs.readFile(
      `${SnapshotPaths.reportsDirectory(snapshotRoot)}/verify-report.md`,
      "utf8",
    );
    expect(verifyReport).toContain("Block payload mismatch");
    expect(verifyReport).toContain("Expected:");
  });
});
