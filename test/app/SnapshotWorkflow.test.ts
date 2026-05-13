import fs from "node:fs/promises";
import { afterEach, describe, expect, it } from "bun:test";
import { ManifestRepository } from "../../src/cas/ManifestRepository.js";
import { ObjectStore } from "../../src/cas/ObjectStore.js";
import { SnapshotWorkflow } from "../../src/export/SnapshotWorkflow.js";
import { ContentHash } from "../../src/domain/ContentHash.js";
import { SQLiteIndex } from "../../src/mappings/SQLiteIndex.js";
import { SnapshotPaths } from "../../src/snapshot/SnapshotPaths.js";
import { FileSystem } from "../../src/util/FileSystem.js";
import { ROOT_PAGE_FIXTURE } from "../fixtures/notion/rootPage.fixture.js";
import {
  ROOT_PAGE_BLOCKS_FIXTURE,
  TOGGLE_CHILD_BLOCKS_FIXTURE,
} from "../fixtures/notion/blocks.fixture.js";
import {
  CHILD_PAGE_BLOCK_FIXTURE,
  CHILD_PAGE_BLOCKS_FIXTURE,
  CHILD_PAGE_FIXTURE,
} from "../fixtures/notion/childPage.fixture.js";
import {
  CHILD_DATABASE_BLOCK_FIXTURE,
  DATABASE_FIXTURE,
  DATABASE_ROW_BLOCKS_FIXTURE,
  DATABASE_ROW_PAGE_FIXTURE,
  DATA_SOURCE_FIXTURE,
} from "../fixtures/notion/database.fixture.js";
import { UNSUPPORTED_BLOCK_FIXTURE } from "../fixtures/notion/coverageBlocks.fixture.js";
import { IMAGE_BLOCK_FIXTURE } from "../fixtures/notion/fileBlocks.fixture.js";
import { createTempDir } from "../helpers/createTempDir.js";

describe("SnapshotWorkflow", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirectories.map((directory) => fs.rm(directory, { recursive: true, force: true })));
    tempDirectories.length = 0;
  });

  it("exports a root notion page into manifest, CAS, and index", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-workflow-");
    tempDirectories.push(snapshotRoot);

    class FakeNotionPageReader {
      public async fetchPage(pageId: string): Promise<Record<string, unknown>> {
        expect(pageId).toBe("01234567-89ab-cdef-0123-456789abcdef");
        return ROOT_PAGE_FIXTURE;
      }
    }

    class FakeNotionBlockReader {
      public async fetchBlockChildren(blockId: string): Promise<readonly Record<string, unknown>[]> {
        if (blockId === "01234567-89ab-cdef-0123-456789abcdef") {
          return ROOT_PAGE_BLOCKS_FIXTURE;
        }

        if (blockId === "22222222-2222-2222-2222-222222222222") {
          return TOGGLE_CHILD_BLOCKS_FIXTURE;
        }

        return [];
      }
    }

    const workflow = new SnapshotWorkflow(
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
    const result = await workflow.run({
      sourcePage: "https://www.notion.so/My-Page-0123456789abcdef0123456789abcdef",
      token: "secret_token",
      snapshotRoot,
      compress: false,
      clock: () => "2026-05-13T07:00:00.000Z",
    });

    expect(result.snapshotRoot).toBe(snapshotRoot);
    expect(result.archivePath).toBeUndefined();

    const manifest = await new ManifestRepository(snapshotRoot).load();
    expect(manifest.toJSON().counts.pages).toBe(1);
    expect(manifest.toJSON().counts.blocks).toBe(3);
    expect(manifest.toJSON().status).toBe("complete");
    expect(manifest.toJSON().artifacts.has_reports).toBe(true);
    expect(manifest.toJSON().root.source_id).toBe(
      "notion://source/page/01234567-89ab-cdef-0123-456789abcdef",
    );
    expect(manifest.toJSON().root.content_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(
      await fs.readFile(`${SnapshotPaths.reportsDirectory(snapshotRoot)}/export-report.md`, "utf8"),
    ).toContain("# Export Report");

    const index = new SQLiteIndex(SnapshotPaths.indexDatabasePath(snapshotRoot));
    const sourceObject = index.getSourceObject(
      "notion://source/page/01234567-89ab-cdef-0123-456789abcdef",
    );
    expect(sourceObject?.object_type).toBe("notion.page");
    expect(sourceObject?.raw_hash).toMatch(/^sha256:[a-f0-9]{64}$/);

    const objectStore = new ObjectStore(snapshotRoot);
    expect(sourceObject?.content_hash).toBeTruthy();
    const storedPage = await objectStore.get<{
      object_type: string;
      canonical: {
        title: { plain_text: string }[];
        children_ref: string;
      };
    }>(ContentHash.parse(sourceObject?.content_hash ?? ""));
    expect(storedPage.object_type).toBe("notion.page");
    expect(storedPage.canonical.title[0]?.plain_text).toBe("Root Page");
    expect(storedPage.canonical.children_ref).toMatch(/^sha256:[a-f0-9]{64}$/);

    const rootChildren = await objectStore.get<{
      object_type: string;
      children: { source_id: string; ref: string }[];
    }>(ContentHash.parse(storedPage.canonical.children_ref));
    expect(rootChildren.object_type).toBe("notion.children");
    expect(rootChildren.children).toHaveLength(2);
    expect(rootChildren.children[1]?.source_id).toBe("22222222-2222-2222-2222-222222222222");

    const nestedToggleBlock = await objectStore.get<{
      object_type: string;
      canonical: {
        block_type: string;
        children_ref: string | null;
      };
    }>(ContentHash.parse(rootChildren.children[1]?.ref ?? ""));
    expect(nestedToggleBlock.canonical.block_type).toBe("toggle");
    expect(nestedToggleBlock.canonical.children_ref).toMatch(/^sha256:[a-f0-9]{64}$/);
    index.close();
  });

  it("emits useful progress messages during export", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-workflow-progress-");
    tempDirectories.push(snapshotRoot);
    const progressMessages: string[] = [];

    class FakeNotionPageReader {
      public async fetchPage(): Promise<Record<string, unknown>> {
        return ROOT_PAGE_FIXTURE;
      }
    }

    class FakeNotionBlockReader {
      public async fetchBlockChildren(blockId: string): Promise<readonly Record<string, unknown>[]> {
        if (blockId === "01234567-89ab-cdef-0123-456789abcdef") {
          return [IMAGE_BLOCK_FIXTURE];
        }

        return [];
      }
    }

    const workflow = new SnapshotWorkflow(
      new FakeNotionPageReader(),
      new FakeNotionBlockReader(),
      {
        download: async () => ({
          bytes: Buffer.from("image-bytes"),
          mimeType: "image/png",
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
      undefined,
      {
        report: (message: string) => {
          progressMessages.push(message);
        },
      },
    );

    await workflow.run({
      sourcePage: "0123456789abcdef0123456789abcdef",
      token: "secret_token",
      snapshotRoot,
      compress: false,
      clock: () => "2026-05-13T07:00:00.000Z",
    });

    expect(progressMessages).toContain("Resolving root: 0123456789abcdef0123456789abcdef");
    expect(progressMessages).toContain("Resolved root as page: 01234567-89ab-cdef-0123-456789abcdef");
    expect(progressMessages).toContain("Starting export into " + snapshotRoot);
    expect(progressMessages).toContain("Exporting page 01234567-89ab-cdef-0123-456789abcdef");
    expect(progressMessages).toContain("Exporting 1 blocks under 01234567-89ab-cdef-0123-456789abcdef");
    expect(progressMessages.some((message) => message.startsWith("Processing block 1/1 under"))).toBe(true);
    expect(progressMessages.some((message) => message.startsWith("Downloading file blob:"))).toBe(true);
  });

  it("downloads and stores blobs for file-backed blocks", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-workflow-files-");
    tempDirectories.push(snapshotRoot);

    class FakeNotionPageReader {
      public async fetchPage(): Promise<Record<string, unknown>> {
        return ROOT_PAGE_FIXTURE;
      }
    }

    class FakeNotionBlockReader {
      public async fetchBlockChildren(blockId: string): Promise<readonly Record<string, unknown>[]> {
        if (blockId === "01234567-89ab-cdef-0123-456789abcdef") {
          return [IMAGE_BLOCK_FIXTURE];
        }

        return [];
      }
    }

    class FakeFileDownloader {
      public async download(url: string): Promise<{ bytes: Uint8Array; mimeType?: string }> {
        expect(url).toBe("https://files.notion.test/image.png");
        return {
          bytes: Buffer.from("image-bytes"),
          mimeType: "image/png",
        };
      }
    }

    const workflow = new SnapshotWorkflow(
      new FakeNotionPageReader(),
      new FakeNotionBlockReader(),
      new FakeFileDownloader(),
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
    await workflow.run({
      sourcePage: "0123456789abcdef0123456789abcdef",
      token: "secret_token",
      snapshotRoot,
      compress: false,
      clock: () => "2026-05-13T07:00:00.000Z",
    });

    const manifest = await new ManifestRepository(snapshotRoot).load();
    expect(manifest.toJSON().counts.files).toBe(1);

    const imageBlockSource = "44444444-4444-4444-4444-444444444444";
    const index = new SQLiteIndex(SnapshotPaths.indexDatabasePath(snapshotRoot));
    const imageBlock = index.getSourceObject(`notion://source/block/${imageBlockSource}`);
    const objectStore = new ObjectStore(snapshotRoot);

    const storedBlock = await objectStore.get<{
      canonical: { payload: { file_ref: string } };
    }>(ContentHash.parse(imageBlock?.content_hash ?? ""));
    const fileRef = await objectStore.get<{
      object_type: string;
      canonical: {
        blob_ref: string;
        mime_type: string;
        name: string;
      };
    }>(ContentHash.parse(storedBlock.canonical.payload.file_ref));

    expect(fileRef.object_type).toBe("notion.file_ref");
    expect(fileRef.canonical.mime_type).toBe("image/png");
    expect(fileRef.canonical.name).toBe("image.png");
    expect(index.getBlobStore(fileRef.canonical.blob_ref)?.mime_type).toBe("image/png");
    index.close();
  });

  it("continues export with warnings when a file download fails", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-workflow-file-failure-");
    tempDirectories.push(snapshotRoot);

    class FakeNotionPageReader {
      public async fetchPage(): Promise<Record<string, unknown>> {
        return ROOT_PAGE_FIXTURE;
      }
    }

    class FakeNotionBlockReader {
      public async fetchBlockChildren(blockId: string): Promise<readonly Record<string, unknown>[]> {
        if (blockId === "01234567-89ab-cdef-0123-456789abcdef") {
          return [IMAGE_BLOCK_FIXTURE];
        }

        return [];
      }
    }

    class FailingFileDownloader {
      public async download(): Promise<{ bytes: Uint8Array; mimeType?: string }> {
        throw new Error("download failed");
      }
    }

    const workflow = new SnapshotWorkflow(
      new FakeNotionPageReader(),
      new FakeNotionBlockReader(),
      new FailingFileDownloader(),
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

    await workflow.run({
      sourcePage: "0123456789abcdef0123456789abcdef",
      token: "secret_token",
      snapshotRoot,
      compress: false,
      clock: () => "2026-05-13T07:00:00.000Z",
    });

    const manifest = await new ManifestRepository(snapshotRoot).load();
    expect(manifest.toJSON().status).toBe("complete_with_warnings");
    expect(manifest.toJSON().counts.failures).toBe(1);
    expect(manifest.toJSON().counts.files).toBe(0);

    expect(
      await fs.readFile(`${SnapshotPaths.reportsDirectory(snapshotRoot)}/export-report.md`, "utf8"),
    ).toContain("- Failures: 1");

    const index = new SQLiteIndex(SnapshotPaths.indexDatabasePath(snapshotRoot));
    const imageBlock = index.getSourceObject(
      "notion://source/block/44444444-4444-4444-4444-444444444444",
    );
    const objectStore = new ObjectStore(snapshotRoot);
    const storedBlock = await objectStore.get<{
      canonical: { payload: { file_ref: string | null } };
    }>(ContentHash.parse(imageBlock?.content_hash ?? ""));
    expect(storedBlock.canonical.payload.file_ref).toBeNull();
    index.close();
  });

  it("preserves partial block payloads as explicit unsupported records", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-workflow-partial-blocks-");
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

    const workflow = new SnapshotWorkflow(
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

    await workflow.run({
      sourcePage: "0123456789abcdef0123456789abcdef",
      token: "secret_token",
      snapshotRoot,
      compress: false,
      clock: () => "2026-05-13T07:00:00.000Z",
    });

    const manifest = await new ManifestRepository(snapshotRoot).load();
    expect(manifest.toJSON().status).toBe("complete_with_warnings");
    expect(manifest.toJSON().counts.unsupported).toBe(1);

    const index = new SQLiteIndex(SnapshotPaths.indexDatabasePath(snapshotRoot));
    const partialBlock = index.getSourceObject(
      "notion://source/block/90909090-9090-9090-9090-909090909090",
    );
    const objectStore = new ObjectStore(snapshotRoot);
    const storedPartial = await objectStore.get<{
      object_type: string;
      canonical: {
        reason: string;
        original_type: string;
        raw_ref: string;
      };
    }>(ContentHash.parse(partialBlock?.content_hash ?? ""));

    expect(storedPartial.object_type).toBe("notion.unsupported");
    expect(storedPartial.canonical.reason).toBe("partial_block_payload");
    expect(storedPartial.canonical.original_type).toBe("unknown");
    expect(storedPartial.canonical.raw_ref).toMatch(/^sha256:[a-f0-9]{64}$/);
    index.close();
  });

  it("downloads file-backed page assets and files properties", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-workflow-page-assets-");
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
            {
              type: "external",
              name: "docs.txt",
              external: {
                url: "https://example.com/docs.txt",
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

    class FakeFileDownloader {
      public async download(url: string): Promise<{ bytes: Uint8Array; mimeType?: string }> {
        return {
          bytes: Buffer.from(`bytes:${url}`),
          mimeType: url.endsWith(".png")
            ? "image/png"
            : url.endsWith(".pdf")
              ? "application/pdf"
              : "text/plain",
        };
      }
    }

    const workflow = new SnapshotWorkflow(
      new FakeNotionPageReader(),
      new FakeNotionBlockReader(),
      new FakeFileDownloader(),
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

    await workflow.run({
      sourcePage: "0123456789abcdef0123456789abcdef",
      token: "secret_token",
      snapshotRoot,
      compress: false,
      clock: () => "2026-05-13T07:00:00.000Z",
    });

    const manifest = await new ManifestRepository(snapshotRoot).load();
    expect(manifest.toJSON().counts.files).toBe(4);

    const index = new SQLiteIndex(SnapshotPaths.indexDatabasePath(snapshotRoot));
    const pageObject = index.getSourceObject("notion://source/page/01234567-89ab-cdef-0123-456789abcdef");
    const objectStore = new ObjectStore(snapshotRoot);
    const storedPage = await objectStore.get<{
      canonical: {
        icon: { file_ref: string };
        cover: { file_ref: string };
        properties: {
          Attachments: {
            type: string;
            value: { file_ref?: string | null; external?: { url: string } }[];
          };
        };
      };
    }>(ContentHash.parse(pageObject?.content_hash ?? ""));

    expect(storedPage.canonical.icon.file_ref).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(storedPage.canonical.cover.file_ref).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(storedPage.canonical.properties.Attachments.value[0]?.file_ref).toMatch(
      /^sha256:[a-f0-9]{64}$/,
    );
    expect(storedPage.canonical.properties.Attachments.value[1]?.file_ref).toMatch(
      /^sha256:[a-f0-9]{64}$/,
    );
    expect(storedPage.canonical.properties.Attachments.value[1]?.external?.url).toBe(
      "https://example.com/docs.txt",
    );
    index.close();
  });

  it("aggregates row-page export failures into child database snapshots", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-workflow-database-row-failure-");
    tempDirectories.push(snapshotRoot);

    class FakeNotionPageReader {
      public async fetchPage(pageId: string): Promise<Record<string, unknown>> {
        if (pageId === "01234567-89ab-cdef-0123-456789abcdef") {
          return ROOT_PAGE_FIXTURE;
        }

        if (pageId === "cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd") {
          return DATABASE_ROW_PAGE_FIXTURE;
        }

        throw new Error(`Unexpected page read: ${pageId}`);
      }
    }

    class FakeNotionBlockReader {
      public async fetchBlockChildren(blockId: string): Promise<readonly Record<string, unknown>[]> {
        if (blockId === "01234567-89ab-cdef-0123-456789abcdef") {
          return [CHILD_DATABASE_BLOCK_FIXTURE];
        }

        if (blockId === "cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd") {
          return [IMAGE_BLOCK_FIXTURE];
        }

        return [];
      }
    }

    class FakeNotionDatabaseReader {
      public async fetchDatabase(databaseId: string): Promise<Record<string, unknown>> {
        expect(databaseId).toBe("99999999-9999-9999-9999-999999999999");
        return DATABASE_FIXTURE;
      }

      public async fetchDataSource(dataSourceId: string): Promise<Record<string, unknown>> {
        expect(dataSourceId).toBe("abababab-abab-abab-abab-abababababab");
        return DATA_SOURCE_FIXTURE;
      }

      public async queryRows(dataSourceId: string): Promise<readonly Record<string, unknown>[]> {
        expect(dataSourceId).toBe("abababab-abab-abab-abab-abababababab");
        return [DATABASE_ROW_PAGE_FIXTURE];
      }
    }

    const workflow = new SnapshotWorkflow(
      new FakeNotionPageReader(),
      new FakeNotionBlockReader(),
      {
        download: async () => {
          throw new Error("download failed");
        },
      },
      new FakeNotionDatabaseReader(),
    );

    await workflow.run({
      sourcePage: "0123456789abcdef0123456789abcdef",
      token: "secret_token",
      snapshotRoot,
      compress: false,
      clock: () => "2026-05-13T07:00:00.000Z",
    });

    const manifest = await new ManifestRepository(snapshotRoot).load();
    expect(manifest.toJSON().status).toBe("complete_with_warnings");
    expect(manifest.toJSON().counts.failures).toBe(1);

    expect(
      await fs.readFile(`${SnapshotPaths.reportsDirectory(snapshotRoot)}/export-report.md`, "utf8"),
    ).toContain("- Failures: 1");
  });

  it("recursively exports child pages referenced by child_page blocks", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-workflow-child-pages-");
    tempDirectories.push(snapshotRoot);

    class FakeNotionPageReader {
      public async fetchPage(pageId: string): Promise<Record<string, unknown>> {
        if (pageId === "01234567-89ab-cdef-0123-456789abcdef") {
          return ROOT_PAGE_FIXTURE;
        }

        if (pageId === "77777777-7777-7777-7777-777777777777") {
          return CHILD_PAGE_FIXTURE;
        }

        throw new Error(`Unexpected page read: ${pageId}`);
      }
    }

    class FakeNotionBlockReader {
      public async fetchBlockChildren(blockId: string): Promise<readonly Record<string, unknown>[]> {
        if (blockId === "01234567-89ab-cdef-0123-456789abcdef") {
          return [CHILD_PAGE_BLOCK_FIXTURE];
        }

        if (blockId === "77777777-7777-7777-7777-777777777777") {
          return CHILD_PAGE_BLOCKS_FIXTURE;
        }

        return [];
      }
    }

    const workflow = new SnapshotWorkflow(
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

    await workflow.run({
      sourcePage: "0123456789abcdef0123456789abcdef",
      token: "secret_token",
      snapshotRoot,
      compress: false,
      clock: () => "2026-05-13T07:00:00.000Z",
    });

    const manifest = await new ManifestRepository(snapshotRoot).load();
    expect(manifest.toJSON().counts.pages).toBe(2);
    expect(manifest.toJSON().counts.blocks).toBe(2);

    const index = new SQLiteIndex(SnapshotPaths.indexDatabasePath(snapshotRoot));
    const rootPage = index.getSourceObject(
      "notion://source/page/01234567-89ab-cdef-0123-456789abcdef",
    );
    const childPage = index.getSourceObject(
      "notion://source/page/77777777-7777-7777-7777-777777777777",
    );
    expect(rootPage?.object_type).toBe("notion.page");
    expect(childPage?.object_type).toBe("notion.page");

    const objectStore = new ObjectStore(snapshotRoot);
    const rootPageObject = await objectStore.get<{
      canonical: { children_ref: string };
    }>(ContentHash.parse(rootPage?.content_hash ?? ""));
    const rootChildren = await objectStore.get<{
      children: { ref: string }[];
    }>(ContentHash.parse(rootPageObject.canonical.children_ref));
    const childPageBlock = await objectStore.get<{
      canonical: { block_type: string; payload: { page_ref: string; title: string } };
    }>(ContentHash.parse(rootChildren.children[0]?.ref ?? ""));

    expect(childPageBlock.canonical.block_type).toBe("child_page");
    expect(childPageBlock.canonical.payload.title).toBe("Nested Child Page");

    const childPageObject = await objectStore.get<{
      canonical: {
        title: { plain_text: string }[];
        children_ref: string;
      };
    }>(ContentHash.parse(childPageBlock.canonical.payload.page_ref));

    expect(childPageObject.canonical.title[0]?.plain_text).toBe("Nested Child Page");
    expect(childPageObject.canonical.children_ref).toMatch(/^sha256:[a-f0-9]{64}$/);
    index.close();
  });

  it("exports child databases, schema objects, and simple row pages", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-workflow-databases-");
    tempDirectories.push(snapshotRoot);

    class FakeNotionPageReader {
      public async fetchPage(pageId: string): Promise<Record<string, unknown>> {
        if (pageId === "01234567-89ab-cdef-0123-456789abcdef") {
          return ROOT_PAGE_FIXTURE;
        }

        if (pageId === "cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd") {
          return DATABASE_ROW_PAGE_FIXTURE;
        }

        throw new Error(`Unexpected page read: ${pageId}`);
      }
    }

    class FakeNotionBlockReader {
      public async fetchBlockChildren(blockId: string): Promise<readonly Record<string, unknown>[]> {
        if (blockId === "01234567-89ab-cdef-0123-456789abcdef") {
          return [CHILD_DATABASE_BLOCK_FIXTURE];
        }

        if (blockId === "cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd") {
          return DATABASE_ROW_BLOCKS_FIXTURE;
        }

        return [];
      }
    }

    class FakeNotionDatabaseReader {
      public async fetchDatabase(databaseId: string): Promise<Record<string, unknown>> {
        expect(databaseId).toBe("99999999-9999-9999-9999-999999999999");
        return DATABASE_FIXTURE;
      }

      public async fetchDataSource(dataSourceId: string): Promise<Record<string, unknown>> {
        expect(dataSourceId).toBe("abababab-abab-abab-abab-abababababab");
        return DATA_SOURCE_FIXTURE;
      }

      public async queryRows(dataSourceId: string): Promise<readonly Record<string, unknown>[]> {
        expect(dataSourceId).toBe("abababab-abab-abab-abab-abababababab");
        return [DATABASE_ROW_PAGE_FIXTURE];
      }
    }

    const workflow = new SnapshotWorkflow(
      new FakeNotionPageReader(),
      new FakeNotionBlockReader(),
      {
        download: async () => ({
          bytes: Buffer.from("unused"),
        }),
      },
      new FakeNotionDatabaseReader(),
    );

    await workflow.run({
      sourcePage: "0123456789abcdef0123456789abcdef",
      token: "secret_token",
      snapshotRoot,
      compress: false,
      clock: () => "2026-05-13T07:00:00.000Z",
    });

    const manifest = await new ManifestRepository(snapshotRoot).load();
    expect(manifest.toJSON().counts.databases).toBe(1);
    expect(manifest.toJSON().counts.rows).toBe(1);
    expect(manifest.toJSON().counts.pages).toBe(2);

    const index = new SQLiteIndex(SnapshotPaths.indexDatabasePath(snapshotRoot));
    const databaseObject = index.getSourceObject(
      "notion://source/database/99999999-9999-9999-9999-999999999999",
    );
    expect(databaseObject?.object_type).toBe("notion.database");
    expect(databaseObject?.raw_hash).toMatch(/^sha256:[a-f0-9]{64}$/);

    const objectStore = new ObjectStore(snapshotRoot);
    const storedDatabase = await objectStore.get<{
      canonical: { schema_ref: string; rows_ref: string };
    }>(ContentHash.parse(databaseObject?.content_hash ?? ""));
    const storedSchema = await objectStore.get<{
      object_type: string;
      canonical: { properties: Record<string, unknown> };
    }>(ContentHash.parse(storedDatabase.canonical.schema_ref));
    const storedRows = await objectStore.get<{
      children: { ref: string }[];
    }>(ContentHash.parse(storedDatabase.canonical.rows_ref));
    const storedRow = await objectStore.get<{
      object_type: string;
      canonical: { page_ref: string };
    }>(ContentHash.parse(storedRows.children[0]?.ref ?? ""));

    expect(storedSchema.object_type).toBe("notion.database_schema");
    expect(storedSchema.canonical.properties).toHaveProperty("Name");
    expect(storedSchema.canonical.properties).toHaveProperty("Status");
    expect(storedRow.object_type).toBe("notion.database_row");
    expect(storedRow.canonical.page_ref).toMatch(/^sha256:[a-f0-9]{64}$/);

    const rawDatabase = await objectStore.get<{ object_type: string }>(
      ContentHash.parse(databaseObject?.raw_hash ?? ""),
    );
    expect(rawDatabase.object_type).toBe("raw.notion.database");
    index.close();
  });

  it("exports every attached data source for a database snapshot", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-workflow-multi-datasource-");
    tempDirectories.push(snapshotRoot);

    const secondDataSource = {
      ...DATA_SOURCE_FIXTURE,
      id: "bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc",
      properties: {
        Name: DATA_SOURCE_FIXTURE.properties.Name,
      },
    };
    const secondRow = {
      ...DATABASE_ROW_PAGE_FIXTURE,
      id: "edededed-eded-eded-eded-edededededed",
      parent: {
        type: "data_source_id",
        data_source_id: "bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc",
      },
      properties: {
        ...DATABASE_ROW_PAGE_FIXTURE.properties,
        Name: {
          ...DATABASE_ROW_PAGE_FIXTURE.properties.Name,
          title: [
            {
              ...DATABASE_ROW_PAGE_FIXTURE.properties.Name.title[0],
              plain_text: "Task Row Two",
              text: {
                content: "Task Row Two",
                link: null,
              },
            },
          ],
        },
      },
    };
    const databaseWithTwoSources = {
      ...DATABASE_FIXTURE,
      data_sources: [
        ...DATABASE_FIXTURE.data_sources,
        {
          id: "bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc",
          name: "Backlog",
        },
      ],
    };

    class FakeNotionPageReader {
      public async fetchPage(pageId: string): Promise<Record<string, unknown>> {
        if (pageId === "01234567-89ab-cdef-0123-456789abcdef") {
          return ROOT_PAGE_FIXTURE;
        }

        if (pageId === "cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd") {
          return DATABASE_ROW_PAGE_FIXTURE;
        }

        if (pageId === "edededed-eded-eded-eded-edededededed") {
          return secondRow;
        }

        throw new Error(`Unexpected page read: ${pageId}`);
      }
    }

    class FakeNotionBlockReader {
      public async fetchBlockChildren(blockId: string): Promise<readonly Record<string, unknown>[]> {
        if (blockId === "01234567-89ab-cdef-0123-456789abcdef") {
          return [CHILD_DATABASE_BLOCK_FIXTURE];
        }

        if (blockId === "cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd") {
          return DATABASE_ROW_BLOCKS_FIXTURE;
        }

        if (blockId === "edededed-eded-eded-eded-edededededed") {
          return [];
        }

        return [];
      }
    }

    class FakeNotionDatabaseReader {
      public async fetchDatabase(): Promise<Record<string, unknown>> {
        return databaseWithTwoSources;
      }

      public async fetchDataSource(dataSourceId: string): Promise<Record<string, unknown>> {
        if (dataSourceId === "abababab-abab-abab-abab-abababababab") {
          return DATA_SOURCE_FIXTURE;
        }

        if (dataSourceId === "bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc") {
          return secondDataSource;
        }

        throw new Error(`Unexpected data source fetch: ${dataSourceId}`);
      }

      public async queryRows(dataSourceId: string): Promise<readonly Record<string, unknown>[]> {
        if (dataSourceId === "abababab-abab-abab-abab-abababababab") {
          return [DATABASE_ROW_PAGE_FIXTURE];
        }

        if (dataSourceId === "bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc") {
          return [secondRow];
        }

        throw new Error(`Unexpected row query: ${dataSourceId}`);
      }
    }

    const workflow = new SnapshotWorkflow(
      new FakeNotionPageReader(),
      new FakeNotionBlockReader(),
      {
        download: async () => ({
          bytes: Buffer.from("unused"),
        }),
      },
      new FakeNotionDatabaseReader(),
    );

    await workflow.run({
      sourcePage: "0123456789abcdef0123456789abcdef",
      token: "secret_token",
      snapshotRoot,
      compress: false,
      clock: () => "2026-05-13T07:00:00.000Z",
    });

    const index = new SQLiteIndex(SnapshotPaths.indexDatabasePath(snapshotRoot));
    const databaseObject = index.getSourceObject(
      "notion://source/database/99999999-9999-9999-9999-999999999999",
    );
    const objectStore = new ObjectStore(snapshotRoot);
    const storedDatabase = await objectStore.get<{
      canonical: {
        data_sources: { source_id: string; schema_ref: string; rows_ref: string }[];
      };
    }>(ContentHash.parse(databaseObject?.content_hash ?? ""));

    expect(storedDatabase.canonical.data_sources).toHaveLength(2);
    expect(storedDatabase.canonical.data_sources.map((entry) => entry.source_id)).toEqual([
      "abababab-abab-abab-abab-abababababab",
      "bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc",
    ]);

    const secondRows = await objectStore.get<{
      children: { source_id: string; ref: string }[];
    }>(ContentHash.parse(storedDatabase.canonical.data_sources[1]!.rows_ref));
    expect(secondRows.children[0]?.source_id).toBe("edededed-eded-eded-eded-edededededed");
    index.close();
  });

  it("supports a database URL as the export root", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-workflow-database-root-");
    tempDirectories.push(snapshotRoot);

    class FakeNotionPageReader {
      public async fetchPage(pageId: string): Promise<Record<string, unknown>> {
        if (pageId === "cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd") {
          return DATABASE_ROW_PAGE_FIXTURE;
        }

        throw new Error("Provided ID is a database");
      }
    }

    class FakeNotionBlockReader {
      public async fetchBlockChildren(blockId: string): Promise<readonly Record<string, unknown>[]> {
        if (blockId === "cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd") {
          return DATABASE_ROW_BLOCKS_FIXTURE;
        }

        return [];
      }
    }

    class FakeNotionDatabaseReader {
      public async fetchDatabase(databaseId: string): Promise<Record<string, unknown>> {
        expect(databaseId).toBe("99999999-9999-9999-9999-999999999999");
        return DATABASE_FIXTURE;
      }

      public async fetchDataSource(dataSourceId: string): Promise<Record<string, unknown>> {
        expect(dataSourceId).toBe("abababab-abab-abab-abab-abababababab");
        return DATA_SOURCE_FIXTURE;
      }

      public async queryRows(): Promise<readonly Record<string, unknown>[]> {
        return [DATABASE_ROW_PAGE_FIXTURE];
      }
    }

    const workflow = new SnapshotWorkflow(
      new FakeNotionPageReader(),
      new FakeNotionBlockReader(),
      {
        download: async () => ({
          bytes: Buffer.from("unused"),
        }),
      },
      new FakeNotionDatabaseReader(),
    );

    await workflow.run({
      sourcePage:
        "https://www.notion.so/awesomebobmedia/99999999999999999999999999999999?v=06f30ddb639846f6b848510c514b0df5&source=copy_link",
      token: "secret_token",
      snapshotRoot,
      compress: false,
      clock: () => "2026-05-13T07:00:00.000Z",
    });

    const manifest = await new ManifestRepository(snapshotRoot).load();
    expect(manifest.toJSON().root.source_id).toBe(
      "notion://source/database/99999999-9999-9999-9999-999999999999",
    );
    expect(manifest.toJSON().counts.databases).toBe(1);

    const index = new SQLiteIndex(SnapshotPaths.indexDatabasePath(snapshotRoot));
    expect(
      index.getSourceObject("notion://source/database/99999999-9999-9999-9999-999999999999")
        ?.object_type,
    ).toBe("notion.database");
    index.close();
  });

  it("counts unsupported blocks honestly in the snapshot manifest and report", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-workflow-unsupported-");
    tempDirectories.push(snapshotRoot);

    class FakeNotionPageReader {
      public async fetchPage(): Promise<Record<string, unknown>> {
        return ROOT_PAGE_FIXTURE;
      }
    }

    class FakeNotionBlockReader {
      public async fetchBlockChildren(blockId: string): Promise<readonly Record<string, unknown>[]> {
        if (blockId === "01234567-89ab-cdef-0123-456789abcdef") {
          return [UNSUPPORTED_BLOCK_FIXTURE];
        }

        return [];
      }
    }

    const workflow = new SnapshotWorkflow(
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

    await workflow.run({
      sourcePage: "0123456789abcdef0123456789abcdef",
      token: "secret_token",
      snapshotRoot,
      compress: false,
      clock: () => "2026-05-13T07:00:00.000Z",
    });

    const manifest = await new ManifestRepository(snapshotRoot).load();
    expect(manifest.toJSON().counts.unsupported).toBe(1);

    expect(
      await fs.readFile(`${SnapshotPaths.reportsDirectory(snapshotRoot)}/export-report.md`, "utf8"),
    ).toContain("- Unsupported objects: 1");
  });

  it("writes a compressed archive when requested", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-workflow-compress-");
    tempDirectories.push(snapshotRoot);

    await FileSystem.ensureDirectory(snapshotRoot);

    class FakeNotionPageReader {
      public async fetchPage(): Promise<Record<string, unknown>> {
        return {
          ...ROOT_PAGE_FIXTURE,
          properties: {
            ...ROOT_PAGE_FIXTURE.properties,
            Name: {
              ...ROOT_PAGE_FIXTURE.properties.Name,
              title: [],
            },
          },
        };
      }
    }

    class FakeNotionBlockReader {
      public async fetchBlockChildren(): Promise<readonly Record<string, unknown>[]> {
        return [];
      }
    }

    const workflow = new SnapshotWorkflow(
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
    const result = await workflow.run({
      sourcePage: "0123456789abcdef0123456789abcdef",
      token: "secret_token",
      snapshotRoot,
      compress: true,
      clock: () => "2026-05-13T07:00:00.000Z",
    });

    expect(result.archivePath).toBe(`${snapshotRoot}.tgz`);
    expect(await fs.stat(`${snapshotRoot}.tgz`)).toBeTruthy();
  });
});
