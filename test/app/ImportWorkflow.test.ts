import fs from "node:fs/promises";
import { afterEach, describe, expect, it } from "bun:test";
import { ImportWorkflow } from "../../src/import/ImportWorkflow.js";
import { SnapshotWorkflow } from "../../src/export/SnapshotWorkflow.js";
import { SQLiteIndex } from "../../src/mappings/SQLiteIndex.js";
import type { DestinationBlockWriter } from "../../src/notion/DestinationBlockWriter.js";
import type { DestinationDatabaseWriter } from "../../src/notion/DestinationDatabaseWriter.js";
import type { DestinationFileUploader } from "../../src/notion/DestinationFileUploader.js";
import type {
  CreatePageShellInput,
  DestinationPageWriter,
} from "../../src/notion/DestinationPageWriter.js";
import { SnapshotPaths } from "../../src/snapshot/SnapshotPaths.js";
import {
  createCoverageReplaySnapshot,
  createDatabaseReplaySnapshot,
  createFileReplaySnapshot,
  createPageTreeSnapshot,
  createReplayablePageTreeSnapshot,
  createRichTextOverflowReplaySnapshot,
} from "../fixtures/import/importSnapshot.fixture.js";
import { ROOT_PAGE_FIXTURE } from "../fixtures/notion/rootPage.fixture.js";
import { createTempDir } from "../helpers/createTempDir.js";

interface RecordedRichTextBlockAppend {
  parentId: string;
  type: string;
  text: string;
}

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

function richTextContentFromBlock(block: Record<string, unknown>): { type: string; text: string } {
  const type = typeof block.type === "string" ? block.type : "unknown";
  const payload = block[type] as Record<string, unknown> | undefined;
  const richText = Array.isArray(payload?.rich_text)
    ? (payload.rich_text as { text?: { content?: string } }[]).map((item) => item.text?.content ?? "")
    : [];
  return {
    type,
    text: richText.join(""),
  };
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

class ReplayableTreePageWriter implements DestinationPageWriter {
  public constructor(private readonly createdPages?: CreatePageShellInput[]) {}

  public async createPageShell(input: CreatePageShellInput): Promise<string> {
    this.createdPages?.push(input);
    return replayableTreePageShellId(input.title);
  }
}

class ReplayableTreeBlockWriter implements DestinationBlockWriter {
  public constructor(private readonly appendedBlocks?: RecordedRichTextBlockAppend[]) {}

  public async appendBlock(input: {
    parentId: string;
    block: Record<string, unknown>;
  }): Promise<string> {
    const { type, text } = richTextContentFromBlock(input.block);
    this.appendedBlocks?.push({ parentId: input.parentId, type, text });
    return replayableTreeBlockId(input.parentId, type, text);
  }
}

describe("ImportWorkflow", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirectories.map((directory) => fs.rm(directory, { recursive: true, force: true })));
    tempDirectories.length = 0;
  });

  it("creates destination page shells and records source-to-destination mappings", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-import-workflow-");
    tempDirectories.push(snapshotRoot);
    await createPageTreeSnapshot(snapshotRoot);

    const createdPages: CreatePageShellInput[] = [];

    class NoOpDestinationBlockWriter implements DestinationBlockWriter {
      public async appendBlock(): Promise<string> {
        throw new Error("unexpected block append");
      }
    }

    const workflow = new ImportWorkflow(
      new ReplayableTreePageWriter(createdPages),
      new NoOpDestinationBlockWriter(),
    );
    const result = await workflow.run({
      snapshotPath: snapshotRoot,
      targetPageId: "99999999-9999-9999-9999-999999999999",
      clock: () => "2026-05-13T08:00:00.000Z",
    });

    expect(result.createdPages).toBe(2);
    expect(createdPages).toHaveLength(2);
    expect(createdPages[0]).toMatchObject({
      title: "Root Page",
      parentId: "99999999-9999-9999-9999-999999999999",
      icon: {
        type: "emoji",
        emoji: "📘",
      },
      cover: {
        type: "external",
        external: {
          url: "https://example.com/root-cover.png",
        },
      },
    });
    expect(createdPages[1]).toMatchObject({
      title: "Nested Child Page",
      parentId: "dest-root-page",
    });
    expect(createdPages[0]?.properties).toMatchObject({
      Name: {
        title: [
          {
            type: "text",
            text: {
              content: "Root Page",
              link: null,
            },
          },
        ],
      },
      Status: {
        status: {
          name: "Todo",
        },
      },
      Notes: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Root page notes",
              link: null,
            },
          },
        ],
      },
      Tags: {
        multi_select: [{ name: "CLI" }, { name: "Snapshot" }],
      },
      Assignee: {
        people: [
          {
            id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            object: "user",
          },
        ],
      },
      Estimate: {
        number: 5,
      },
      Link: {
        url: "https://example.com/root-page",
      },
      Done: {
        checkbox: false,
      },
      Due: {
        date: {
          start: "2026-05-20",
        },
      },
      Email: {
        email: "root@example.com",
      },
      Phone: {
        phone_number: "555-0111",
      },
    });

    const index = new SQLiteIndex(SnapshotPaths.indexDatabasePath(snapshotRoot));
    const destinationRoot = index.getDestinationObject(
      "notion://source/page/01234567-89ab-cdef-0123-456789abcdef",
    );
    const destinationChild = index.getDestinationObject(
      "notion://source/page/77777777-7777-7777-7777-777777777777",
    );

    expect(destinationRoot?.destination_id).toBe("dest-root-page");
    expect(destinationChild?.destination_id).toBe("dest-child-page");
    index.close();
  });

  it("replays supported blocks into destination pages and nested destination blocks", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-import-replay-");
    tempDirectories.push(snapshotRoot);
    await createReplayablePageTreeSnapshot(snapshotRoot);

    const createdPages: CreatePageShellInput[] = [];
    const appendedBlocks: { parentId: string; type: string; text: string }[] = [];

    const workflow = new ImportWorkflow(
      new ReplayableTreePageWriter(createdPages),
      new ReplayableTreeBlockWriter(appendedBlocks),
    );
    const result = await workflow.run({
      snapshotPath: snapshotRoot,
      targetPageId: "99999999-9999-9999-9999-999999999999",
      clock: () => "2026-05-13T08:00:00.000Z",
    });

    expect(result.createdPages).toBe(2);
    expect(result.createdBlocks).toBe(4);
    expect(result.transformedBlocks).toBe(1);
    expect(result.skippedBlocks).toBe(0);
    expect(createdPages).toHaveLength(2);
    expect(createdPages[0]).toMatchObject({
      title: "Root Page",
      parentId: "99999999-9999-9999-9999-999999999999",
    });
    expect(createdPages[1]).toMatchObject({
      title: "Nested Child Page",
      parentId: "dest-root-page",
    });
    expect(appendedBlocks).toEqual([
      { parentId: "dest-root-page", type: "paragraph", text: "Intro paragraph" },
      { parentId: "dest-root-page", type: "toggle", text: "Details" },
      { parentId: "dest-root-toggle", type: "to_do", text: "Nested task" },
      { parentId: "dest-child-page", type: "paragraph", text: "Nested page paragraph" },
    ]);

    const index = new SQLiteIndex(SnapshotPaths.indexDatabasePath(snapshotRoot));
    expect(
      index.getDestinationObject("notion://source/block/11111111-1111-1111-1111-111111111111")
        ?.destination_id,
    ).toBe("dest-root-paragraph");
    expect(
      index.getDestinationObject("notion://source/block/22222222-2222-2222-2222-222222222222")
        ?.destination_id,
    ).toBe("dest-root-toggle");
    expect(
      index.getDestinationObject("notion://source/block/33333333-3333-3333-3333-333333333333")
        ?.destination_id,
    ).toBe("dest-toggle-todo");
    expect(
      index.getDestinationObject("notion://source/block/88888888-8888-8888-8888-888888888888")
        ?.destination_id,
    ).toBe("dest-child-paragraph");
    expect(
      index.getDestinationObject("notion://source/block/77777777-7777-7777-7777-777777777777"),
    ).toBeUndefined();
    index.close();

    expect(
      await fs.readFile(`${SnapshotPaths.reportsDirectory(snapshotRoot)}/import-report.md`, "utf8"),
    ).toContain("- Preserved with transformation: 1");
  });

  it("uploads local blobs and replays file-backed blocks", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-import-files-");
    tempDirectories.push(snapshotRoot);
    await createFileReplaySnapshot(snapshotRoot);

    const uploadedFiles: { filename: string; mimeType: string; bytes: string }[] = [];
    const appendedBlocks: { parentId: string; type: string; fileUploadId: string }[] = [];

    class FakeDestinationPageWriter implements DestinationPageWriter {
      public async createPageShell(input: CreatePageShellInput): Promise<string> {
        expect(input).toEqual({
          title: "Root Page",
          parentId: "99999999-9999-9999-9999-999999999999",
          properties: expect.any(Object),
          icon: {
            type: "emoji",
            emoji: "📘",
          },
          cover: {
            type: "external",
            external: {
              url: "https://example.com/root-cover.png",
            },
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
        const fileUpload = payload.file_upload as { id: string };
        appendedBlocks.push({
          parentId: input.parentId,
          type,
          fileUploadId: fileUpload.id,
        });

        return `dest-${type}-block`;
      }
    }

    class FakeDestinationFileUploader implements DestinationFileUploader {
      public async uploadFile(input: {
        filename: string;
        mimeType: string;
        bytes: Uint8Array;
      }): Promise<string> {
        uploadedFiles.push({
          filename: input.filename,
          mimeType: input.mimeType,
          bytes: Buffer.from(input.bytes).toString("utf8"),
        });

        return `upload-${input.filename}`;
      }
    }

    const workflow = new ImportWorkflow(
      new FakeDestinationPageWriter(),
      new FakeDestinationBlockWriter(),
      {
        fileUploader: new FakeDestinationFileUploader(),
      },
    );

    const result = await workflow.run({
      snapshotPath: snapshotRoot,
      targetPageId: "99999999-9999-9999-9999-999999999999",
      clock: () => "2026-05-13T08:00:00.000Z",
    });

    expect(result.createdPages).toBe(1);
    expect(result.createdBlocks).toBe(3);
    expect(result.uploadedFiles).toBe(3);
    expect(result.skippedBlocks).toBe(0);
    expect(uploadedFiles).toEqual([
      { filename: "image.png", mimeType: "image/png", bytes: "image-bytes" },
      { filename: "notes.txt", mimeType: "text/plain", bytes: "notes-bytes" },
      { filename: "spec.pdf", mimeType: "application/pdf", bytes: "pdf-bytes" },
    ]);
    expect(appendedBlocks).toEqual([
      { parentId: "dest-root-page", type: "image", fileUploadId: "upload-image.png" },
      { parentId: "dest-root-page", type: "file", fileUploadId: "upload-notes.txt" },
      { parentId: "dest-root-page", type: "pdf", fileUploadId: "upload-spec.pdf" },
    ]);

    expect(
      await fs.readFile(`${SnapshotPaths.reportsDirectory(snapshotRoot)}/import-report.md`, "utf8"),
    ).toContain("- Files uploaded: 3");
  });

  it("recreates child databases, row pages, and row page blocks", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-import-database-");
    tempDirectories.push(snapshotRoot);
    await createDatabaseReplaySnapshot(snapshotRoot);

    const createdDatabases: {
      parentPageId: string;
      title: string;
      description: string;
      propertyNames: string[];
    }[] = [];
    const createdRows: {
      dataSourceId: string;
      properties: Record<string, unknown>;
    }[] = [];
    const appendedBlocks: { parentId: string; type: string; text: string }[] = [];

    class FakeDestinationPageWriter implements DestinationPageWriter {
      public async createPageShell(input: CreatePageShellInput): Promise<string> {
        expect(input).toEqual({
          title: "Root Page",
          parentId: "99999999-9999-9999-9999-999999999999",
          properties: expect.any(Object),
          icon: {
            type: "emoji",
            emoji: "📘",
          },
          cover: {
            type: "external",
            external: {
              url: "https://example.com/root-cover.png",
            },
          },
        });
        return "dest-root-page";
      }
    }

    class FakeDestinationDatabaseWriter implements DestinationDatabaseWriter {
      public async createInlineDatabase(input: {
        parentPageId: string;
        title: string;
        description: { text?: { content?: string } }[];
        properties: Record<string, unknown>;
      }): Promise<{ databaseId: string; dataSourceId: string }> {
        createdDatabases.push({
          parentPageId: input.parentPageId,
          title: input.title,
          description: input.description.map((segment) => segment.text?.content ?? "").join(""),
          propertyNames: Object.keys(input.properties).sort(),
        });

        return {
          databaseId: "dest-database",
          dataSourceId: "dest-data-source",
        };
      }

      public async createRowPage(input: {
        dataSourceId: string;
        properties: Record<string, unknown>;
      }): Promise<string> {
        createdRows.push(input);
        return "dest-row-page";
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
        appendedBlocks.push({
          parentId: input.parentId,
          type,
          text: richText.join(""),
        });

        return "dest-row-block";
      }
    }

    const workflow = new ImportWorkflow(
      new FakeDestinationPageWriter(),
      new FakeDestinationBlockWriter(),
      {
        databaseWriter: new FakeDestinationDatabaseWriter(),
      },
    );

    const result = await workflow.run({
      snapshotPath: snapshotRoot,
      targetPageId: "99999999-9999-9999-9999-999999999999",
      clock: () => "2026-05-13T08:00:00.000Z",
    });

    expect(result.createdPages).toBe(2);
    expect(result.createdBlocks).toBe(1);
    expect(result.transformedBlocks).toBe(1);
    expect(result.skippedBlocks).toBe(0);
    expect(createdDatabases).toEqual([
      {
        parentPageId: "dest-root-page",
        title: "Tasks Database",
        description: "Imported tasks database",
        propertyNames: [
          "Assignee",
          "Created By",
          "Created Time",
          "Done",
          "Due",
          "Email",
          "Estimate",
          "Files",
          "Link",
          "Name",
          "Notes",
          "Phone",
          "Status",
          "Tags",
          "Ticket",
          "Updated By",
          "Updated Time",
        ],
      },
    ]);
    expect(createdRows).toEqual([
      {
        dataSourceId: "dest-data-source",
        properties: {
          Name: {
            title: [
              {
                type: "text",
                text: {
                  content: "Task Row",
                  link: null,
                },
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
          },
          Status: {
            status: {
              name: "Todo",
            },
          },
          Notes: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: "Important task",
                  link: null,
                },
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
          },
          Tags: {
            multi_select: [{ name: "Backend" }, { name: "CLI" }],
          },
          Assignee: {
            people: [
              {
                id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                object: "user",
              },
            ],
          },
          Estimate: {
            number: 3,
          },
          Link: {
            url: "https://example.com/task-row",
          },
          Done: {
            checkbox: true,
          },
          Due: {
            date: {
              start: "2026-05-20",
            },
          },
          Email: {
            email: "task@example.com",
          },
          Phone: {
            phone_number: "555-0100",
          },
        },
      },
    ]);
    expect(appendedBlocks).toEqual([
      { parentId: "dest-row-page", type: "paragraph", text: "Row details" },
    ]);

    const index = new SQLiteIndex(SnapshotPaths.indexDatabasePath(snapshotRoot));
    expect(
      index.getDestinationObject("notion://source/database/99999999-9999-9999-9999-999999999999")
        ?.destination_id,
    ).toBe("dest-database");
    expect(
      index.getDestinationObject("notion://source/page/cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd")
        ?.destination_id,
    ).toBe("dest-row-page");
    index.close();

    expect(
      await fs.readFile(`${SnapshotPaths.reportsDirectory(snapshotRoot)}/import-report.md`, "utf8"),
    ).toContain("- Preserved with transformation: 1");
  });

  it("continues importing sibling content when one block append fails", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-import-failures-");
    tempDirectories.push(snapshotRoot);
    await createReplayablePageTreeSnapshot(snapshotRoot);

    class FakeDestinationPageWriter implements DestinationPageWriter {
      public async createPageShell(input: CreatePageShellInput): Promise<string> {
        if (input.title === "Root Page") {
          return "dest-root-page";
        }

        if (input.title === "Nested Child Page") {
          return "dest-child-page";
        }

        throw new Error(`Unexpected page shell input: ${JSON.stringify(input)}`);
      }
    }

    class FlakyDestinationBlockWriter implements DestinationBlockWriter {
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

        if (type === "paragraph" && text === "Intro paragraph") {
          throw new Error("append failed");
        }

        if (type === "toggle") {
          return "dest-root-toggle";
        }

        if (type === "to_do") {
          return "dest-toggle-todo";
        }

        if (type === "paragraph" && text === "Nested page paragraph") {
          return "dest-child-paragraph";
        }

        throw new Error(`Unexpected block append input: ${JSON.stringify(input)}`);
      }
    }

    const workflow = new ImportWorkflow(
      new FakeDestinationPageWriter(),
      new FlakyDestinationBlockWriter(),
    );

    const result = await workflow.run({
      snapshotPath: snapshotRoot,
      targetPageId: "99999999-9999-9999-9999-999999999999",
      clock: () => "2026-05-13T08:00:00.000Z",
    });

    expect(result.createdPages).toBe(2);
    expect(result.createdBlocks).toBe(3);
    expect(result.transformedBlocks).toBe(1);
    expect(result.failures).toBe(1);
    expect(result.skippedBlocks).toBe(0);

    expect(
      await fs.readFile(`${SnapshotPaths.reportsDirectory(snapshotRoot)}/import-report.md`, "utf8"),
    ).toContain("- Failures: 1");
  });

  it("skips explicit partial-block unsupported nodes instead of treating them as replayable", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-import-partial-blocks-");
    tempDirectories.push(snapshotRoot);

    class FakeNotionPageReader {
      public async fetchPage(): Promise<Record<string, unknown>> {
        return ROOT_PAGE_FIXTURE;
      }
    }

    class FakeNotionBlockReader {
      public async fetchBlockChildren(blockId: string): Promise<readonly Record<string, unknown>[]> {
        if (blockId === "01234567-89ab-cdef-0123-456789abcdef") {
          return [
            {
              object: "block",
              id: "90909090-9090-9090-9090-909090909090",
              has_children: false,
            },
          ];
        }

        return [];
      }
    }

    const snapshotWorkflow = new SnapshotWorkflow(
      new FakeNotionPageReader(),
      new FakeNotionBlockReader(),
      {
        download: async () => ({
          bytes: Buffer.from("unused"),
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
    );

    await snapshotWorkflow.run({
      sourcePage: "0123456789abcdef0123456789abcdef",
      token: "secret_token",
      snapshotRoot,
      compress: false,
      clock: () => "2026-05-13T07:00:00.000Z",
    });

    const createdPages: CreatePageShellInput[] = [];
    const appendedBlocks: Record<string, unknown>[] = [];

    class FakeDestinationPageWriter implements DestinationPageWriter {
      public async createPageShell(input: CreatePageShellInput): Promise<string> {
        createdPages.push(input);
        return "dest-root-page";
      }
    }

    class FakeDestinationBlockWriter implements DestinationBlockWriter {
      public async appendBlock(input: {
        parentId: string;
        block: Record<string, unknown>;
      }): Promise<string> {
        appendedBlocks.push(input.block);
        return "dest-block";
      }
    }

    const result = await new ImportWorkflow(
      new FakeDestinationPageWriter(),
      new FakeDestinationBlockWriter(),
    ).run({
      snapshotPath: snapshotRoot,
      targetPageId: "99999999-9999-9999-9999-999999999999",
      clock: () => "2026-05-13T08:00:00.000Z",
    });

    expect(result.createdPages).toBe(1);
    expect(result.createdBlocks).toBe(0);
    expect(result.skippedBlocks).toBe(1);
    expect(appendedBlocks).toEqual([]);
    expect(createdPages[0]?.title).toBe("Root Page");
  });

  it("uploads file-backed page assets and files properties into page-shell inputs", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-import-page-file-assets-");
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
          mimeType: url.endsWith(".png") ? "image/png" : "application/pdf",
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

    const createdPages: CreatePageShellInput[] = [];
    const uploadedFiles: { filename: string; mimeType: string; bytes: string }[] = [];

    class FakeDestinationPageWriter implements DestinationPageWriter {
      public async createPageShell(input: CreatePageShellInput): Promise<string> {
        createdPages.push(input);
        return "dest-root-page";
      }
    }

    class FakeDestinationFileUploader implements DestinationFileUploader {
      public async uploadFile(input: {
        filename: string;
        mimeType: string;
        bytes: Uint8Array;
      }): Promise<string> {
        uploadedFiles.push({
          filename: input.filename,
          mimeType: input.mimeType,
          bytes: Buffer.from(input.bytes).toString("utf8"),
        });
        return `upload-${input.filename}`;
      }
    }

    class NoOpDestinationBlockWriter implements DestinationBlockWriter {
      public async appendBlock(): Promise<string> {
        throw new Error("unexpected block append");
      }
    }

    await new ImportWorkflow(
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

    expect(createdPages).toHaveLength(1);
    expect(uploadedFiles).toEqual([
      {
        filename: "spec.pdf",
        mimeType: "application/pdf",
        bytes: "bytes:https://files.notion.test/spec.pdf",
      },
      {
        filename: "page-icon.png",
        mimeType: "image/png",
        bytes: "bytes:https://files.notion.test/page-icon.png",
      },
      {
        filename: "page-cover.png",
        mimeType: "image/png",
        bytes: "bytes:https://files.notion.test/page-cover.png",
      },
    ]);
    expect(createdPages[0]?.icon).toEqual({
      type: "file_upload",
      file_upload: {
        id: "upload-page-icon.png",
      },
    });
    expect(createdPages[0]?.cover).toEqual({
      type: "file_upload",
      file_upload: {
        id: "upload-page-cover.png",
      },
    });
    expect(createdPages[0]?.properties).toHaveProperty("Attachments");
    expect(createdPages[0]?.properties?.Attachments).toEqual({
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
  });

  it("replays linked text, callout icons, and tables with inline rows", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-import-coverage-");
    tempDirectories.push(snapshotRoot);
    await createCoverageReplaySnapshot(snapshotRoot);

    const appendedBlocks: { parentId: string; block: Record<string, unknown> }[] = [];

    class FakeDestinationPageWriter implements DestinationPageWriter {
      public async createPageShell(input: CreatePageShellInput): Promise<string> {
        expect(input).toEqual({
          title: "Root Page",
          parentId: "99999999-9999-9999-9999-999999999999",
          properties: expect.any(Object),
          icon: {
            type: "emoji",
            emoji: "📘",
          },
          cover: {
            type: "external",
            external: {
              url: "https://example.com/root-cover.png",
            },
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
        appendedBlocks.push(input);
        return `dest-${String(input.block.type)}-block`;
      }
    }

    const workflow = new ImportWorkflow(
      new FakeDestinationPageWriter(),
      new FakeDestinationBlockWriter(),
    );

    const result = await workflow.run({
      snapshotPath: snapshotRoot,
      targetPageId: "99999999-9999-9999-9999-999999999999",
      clock: () => "2026-05-13T08:00:00.000Z",
    });

    expect(result.createdPages).toBe(1);
    expect(result.createdBlocks).toBe(4);
    expect(result.skippedBlocks).toBe(0);
    expect(appendedBlocks).toEqual([
      {
        parentId: "dest-root-page",
        block: {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: "Cursor docs",
                  link: {
                    url: "https://cursor.com/docs",
                  },
                },
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
          },
        },
      },
      {
        parentId: "dest-root-page",
        block: {
          object: "block",
          type: "callout",
          callout: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: "Callout text",
                  link: null,
                },
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
            color: "yellow_background",
            icon: {
              type: "emoji",
              emoji: "⚠️",
            },
          },
        },
      },
      {
        parentId: "dest-root-page",
        block: {
          object: "block",
          type: "table",
          table: {
            table_width: 2,
            has_column_header: true,
            has_row_header: false,
            children: [
              {
                type: "table_row",
                table_row: {
                  cells: [
                    [
                      {
                        type: "text",
                        text: {
                          content: "Header",
                          link: null,
                        },
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
                        type: "text",
                        text: {
                          content: "Value",
                          link: null,
                        },
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
                  ],
                },
              },
            ],
          },
        },
      },
    ]);

    const index = new SQLiteIndex(SnapshotPaths.indexDatabasePath(snapshotRoot));
    expect(
      index.getDestinationObject("notion://source/block/11112222-3333-4444-5555-666677778888")
        ?.destination_id,
    ).toBe("dest-paragraph-block");
    expect(
      index.getDestinationObject("notion://source/block/10101010-1010-1010-1010-101010101010")
        ?.destination_id,
    ).toBe("dest-callout-block");
    expect(
      index.getDestinationObject("notion://source/block/40404040-4040-4040-4040-404040404040")
        ?.destination_id,
    ).toBe("dest-table-block");
    expect(
      index.getDestinationObject("notion://source/block/50505050-5050-5050-5050-505050505050"),
    ).toBeUndefined();
    index.close();
  });

  it("compacts oversized rich-text arrays before appending replayed blocks", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-import-rich-text-overflow-");
    tempDirectories.push(snapshotRoot);
    await createRichTextOverflowReplaySnapshot(snapshotRoot);

    const appendedBlocks: { parentId: string; block: Record<string, unknown> }[] = [];

    class FakeDestinationPageWriter implements DestinationPageWriter {
      public async createPageShell(input: CreatePageShellInput): Promise<string> {
        expect(input.title).toBe("Root Page");
        expect(input.parentId).toBe("99999999-9999-9999-9999-999999999999");
        return "dest-root-page";
      }
    }

    class FakeDestinationBlockWriter implements DestinationBlockWriter {
      public async appendBlock(input: {
        parentId: string;
        block: Record<string, unknown>;
      }): Promise<string> {
        appendedBlocks.push(input);
        return "dest-overflow-todo";
      }
    }

    const workflow = new ImportWorkflow(
      new FakeDestinationPageWriter(),
      new FakeDestinationBlockWriter(),
    );

    const result = await workflow.run({
      snapshotPath: snapshotRoot,
      targetPageId: "99999999-9999-9999-9999-999999999999",
      clock: () => "2026-05-13T08:00:00.000Z",
    });

    expect(result.createdPages).toBe(1);
    expect(result.createdBlocks).toBe(1);
    expect(result.failures).toBe(0);
    expect(appendedBlocks).toHaveLength(1);
    expect(appendedBlocks[0]?.parentId).toBe("dest-root-page");
    expect((appendedBlocks[0]?.block.to_do as { rich_text: unknown[] }).rich_text).toHaveLength(1);
    expect(
      ((appendedBlocks[0]?.block.to_do as {
        rich_text: { text: { content: string } }[];
      }).rich_text[0]?.text.content ?? "").startsWith("s0s1s2"),
    ).toBe(true);
  });
});
