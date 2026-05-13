import { SnapshotWorkflow } from "../../../src/export/SnapshotWorkflow.js";
import type { FileDownloader } from "../../../src/notion/FileDownloader.js";
import type { NotionDatabaseReader } from "../../../src/notion/NotionDatabaseReader.js";
import type { NotionBlockReader } from "../../../src/notion/NotionBlockReader.js";
import type { NotionPageReader } from "../../../src/notion/NotionPageReader.js";
import {
  CHILD_PAGE_BLOCK_FIXTURE,
  CHILD_PAGE_BLOCKS_FIXTURE,
  CHILD_PAGE_FIXTURE,
} from "../notion/childPage.fixture.js";
import {
  ROOT_PAGE_BLOCKS_FIXTURE,
  TOGGLE_CHILD_BLOCKS_FIXTURE,
} from "../notion/blocks.fixture.js";
import { ROOT_PAGE_FIXTURE } from "../notion/rootPage.fixture.js";
import {
  CALLOUT_BLOCK_FIXTURE,
  LINKED_PARAGRAPH_BLOCK_FIXTURE,
  TABLE_BLOCK_FIXTURE,
  TABLE_ROW_BLOCK_FIXTURE,
} from "../notion/coverageBlocks.fixture.js";
import {
  FILE_BLOCK_FIXTURE,
  IMAGE_BLOCK_FIXTURE,
  PDF_BLOCK_FIXTURE,
} from "../notion/fileBlocks.fixture.js";
import {
  CHILD_DATABASE_BLOCK_FIXTURE,
  DATABASE_FIXTURE,
  DATABASE_ROW_BLOCKS_FIXTURE,
  DATABASE_ROW_PAGE_FIXTURE,
  DATA_SOURCE_FIXTURE,
} from "../notion/database.fixture.js";

export async function createPageTreeSnapshot(snapshotRoot: string): Promise<void> {
  class FakeNotionPageReader implements NotionPageReader {
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

  class FakeNotionBlockReader implements NotionBlockReader {
    public async fetchBlockChildren(blockId: string): Promise<readonly Record<string, unknown>[]> {
      if (blockId === "01234567-89ab-cdef-0123-456789abcdef") {
        return [CHILD_PAGE_BLOCK_FIXTURE];
      }

      return [];
    }
  }

  const noOpDownloader: FileDownloader = {
    download: async () => ({
      bytes: Buffer.from("unused"),
    }),
  };

  const noOpDatabaseReader: NotionDatabaseReader = {
    fetchDatabase: async () => {
      throw new Error("unexpected database fetch");
    },
    fetchDataSource: async () => {
      throw new Error("unexpected data source fetch");
    },
    queryRows: async () => {
      throw new Error("unexpected row query");
    },
  };

  const workflow = new SnapshotWorkflow(
    new FakeNotionPageReader(),
    new FakeNotionBlockReader(),
    noOpDownloader,
    noOpDatabaseReader,
  );

  await workflow.run({
    sourcePage: "0123456789abcdef0123456789abcdef",
    token: "secret_token",
    snapshotRoot,
    compress: false,
    clock: () => "2026-05-13T07:00:00.000Z",
  });
}

export async function createReplayablePageTreeSnapshot(snapshotRoot: string): Promise<void> {
  class FakeNotionPageReader implements NotionPageReader {
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

  class FakeNotionBlockReader implements NotionBlockReader {
    public async fetchBlockChildren(blockId: string): Promise<readonly Record<string, unknown>[]> {
      if (blockId === "01234567-89ab-cdef-0123-456789abcdef") {
        return [...ROOT_PAGE_BLOCKS_FIXTURE, CHILD_PAGE_BLOCK_FIXTURE];
      }

      if (blockId === "22222222-2222-2222-2222-222222222222") {
        return TOGGLE_CHILD_BLOCKS_FIXTURE;
      }

      if (blockId === "77777777-7777-7777-7777-777777777777") {
        return CHILD_PAGE_BLOCKS_FIXTURE;
      }

      return [];
    }
  }

  const noOpDownloader: FileDownloader = {
    download: async () => ({
      bytes: Buffer.from("unused"),
    }),
  };

  const noOpDatabaseReader: NotionDatabaseReader = {
    fetchDatabase: async () => {
      throw new Error("unexpected database fetch");
    },
    fetchDataSource: async () => {
      throw new Error("unexpected data source fetch");
    },
    queryRows: async () => {
      throw new Error("unexpected row query");
    },
  };

  const workflow = new SnapshotWorkflow(
    new FakeNotionPageReader(),
    new FakeNotionBlockReader(),
    noOpDownloader,
    noOpDatabaseReader,
  );

  await workflow.run({
    sourcePage: "0123456789abcdef0123456789abcdef",
    token: "secret_token",
    snapshotRoot,
    compress: false,
    clock: () => "2026-05-13T07:00:00.000Z",
  });
}

export async function createFileReplaySnapshot(snapshotRoot: string): Promise<void> {
  class FakeNotionPageReader implements NotionPageReader {
    public async fetchPage(pageId: string): Promise<Record<string, unknown>> {
      if (pageId === "01234567-89ab-cdef-0123-456789abcdef") {
        return ROOT_PAGE_FIXTURE;
      }

      throw new Error(`Unexpected page read: ${pageId}`);
    }
  }

  class FakeNotionBlockReader implements NotionBlockReader {
    public async fetchBlockChildren(blockId: string): Promise<readonly Record<string, unknown>[]> {
      if (blockId === "01234567-89ab-cdef-0123-456789abcdef") {
        return [IMAGE_BLOCK_FIXTURE, FILE_BLOCK_FIXTURE, PDF_BLOCK_FIXTURE];
      }

      return [];
    }
  }

  class FakeFileDownloader implements FileDownloader {
    public async download(url: string): Promise<{ bytes: Uint8Array; mimeType?: string }> {
      if (url.endsWith("image.png")) {
        return {
          bytes: Buffer.from("image-bytes"),
          mimeType: "image/png",
        };
      }

      if (url.endsWith("notes.txt")) {
        return {
          bytes: Buffer.from("notes-bytes"),
          mimeType: "text/plain",
        };
      }

      if (url.endsWith("spec.pdf")) {
        return {
          bytes: Buffer.from("pdf-bytes"),
          mimeType: "application/pdf",
        };
      }

      throw new Error(`Unexpected file download: ${url}`);
    }
  }

  const noOpDatabaseReader: NotionDatabaseReader = {
    fetchDatabase: async () => {
      throw new Error("unexpected database fetch");
    },
    fetchDataSource: async () => {
      throw new Error("unexpected data source fetch");
    },
    queryRows: async () => {
      throw new Error("unexpected row query");
    },
  };

  const workflow = new SnapshotWorkflow(
    new FakeNotionPageReader(),
    new FakeNotionBlockReader(),
    new FakeFileDownloader(),
    noOpDatabaseReader,
  );

  await workflow.run({
    sourcePage: "0123456789abcdef0123456789abcdef",
    token: "secret_token",
    snapshotRoot,
    compress: false,
    clock: () => "2026-05-13T07:00:00.000Z",
  });
}

export async function createDatabaseReplaySnapshot(snapshotRoot: string): Promise<void> {
  class FakeNotionPageReader implements NotionPageReader {
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

  class FakeNotionBlockReader implements NotionBlockReader {
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

  const noOpDownloader: FileDownloader = {
    download: async () => ({
      bytes: Buffer.from("unused"),
    }),
  };

  const databaseReader: NotionDatabaseReader = {
    fetchDatabase: async (databaseId: string) => {
      if (databaseId === "99999999-9999-9999-9999-999999999999") {
        return DATABASE_FIXTURE;
      }

      throw new Error(`Unexpected database fetch: ${databaseId}`);
    },
    fetchDataSource: async (dataSourceId: string) => {
      if (dataSourceId === "abababab-abab-abab-abab-abababababab") {
        return DATA_SOURCE_FIXTURE;
      }

      throw new Error(`Unexpected data source fetch: ${dataSourceId}`);
    },
    queryRows: async (dataSourceId: string) => {
      if (dataSourceId === "abababab-abab-abab-abab-abababababab") {
        return [DATABASE_ROW_PAGE_FIXTURE];
      }

      throw new Error(`Unexpected row query: ${dataSourceId}`);
    },
  };

  const workflow = new SnapshotWorkflow(
    new FakeNotionPageReader(),
    new FakeNotionBlockReader(),
    noOpDownloader,
    databaseReader,
  );

  await workflow.run({
    sourcePage: "0123456789abcdef0123456789abcdef",
    token: "secret_token",
    snapshotRoot,
    compress: false,
    clock: () => "2026-05-13T07:00:00.000Z",
  });
}

export async function createRootDatabaseSnapshot(snapshotRoot: string): Promise<void> {
  class FakeNotionPageReader implements NotionPageReader {
    public async fetchPage(pageId: string): Promise<Record<string, unknown>> {
      if (pageId === "cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd") {
        return DATABASE_ROW_PAGE_FIXTURE;
      }

      throw new Error(`Unexpected page read: ${pageId}`);
    }
  }

  class FakeNotionBlockReader implements NotionBlockReader {
    public async fetchBlockChildren(blockId: string): Promise<readonly Record<string, unknown>[]> {
      if (blockId === "cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd") {
        return DATABASE_ROW_BLOCKS_FIXTURE;
      }

      return [];
    }
  }

  const noOpDownloader: FileDownloader = {
    download: async () => ({
      bytes: Buffer.from("unused"),
    }),
  };

  const databaseReader: NotionDatabaseReader = {
    fetchDatabase: async (databaseId: string) => {
      if (databaseId === "99999999-9999-9999-9999-999999999999") {
        return DATABASE_FIXTURE;
      }

      throw new Error(`Unexpected database fetch: ${databaseId}`);
    },
    fetchDataSource: async (dataSourceId: string) => {
      if (dataSourceId === "abababab-abab-abab-abab-abababababab") {
        return DATA_SOURCE_FIXTURE;
      }

      throw new Error(`Unexpected data source fetch: ${dataSourceId}`);
    },
    queryRows: async (dataSourceId: string) => {
      if (dataSourceId === "abababab-abab-abab-abab-abababababab") {
        return [DATABASE_ROW_PAGE_FIXTURE];
      }

      throw new Error(`Unexpected row query: ${dataSourceId}`);
    },
  };

  const workflow = new SnapshotWorkflow(
    new FakeNotionPageReader(),
    new FakeNotionBlockReader(),
    noOpDownloader,
    databaseReader,
    {
      resolveRoot: async () => ({
        kind: "database",
        id: "99999999-9999-9999-9999-999999999999",
        sourceId: "notion://source/database/99999999-9999-9999-9999-999999999999",
      }),
    },
  );

  await workflow.run({
    sourcePage: "99999999999999999999999999999999",
    token: "secret_token",
    snapshotRoot,
    compress: false,
    clock: () => "2026-05-13T07:00:00.000Z",
  });
}

export async function createCoverageReplaySnapshot(snapshotRoot: string): Promise<void> {
  class FakeNotionPageReader implements NotionPageReader {
    public async fetchPage(pageId: string): Promise<Record<string, unknown>> {
      if (pageId === "01234567-89ab-cdef-0123-456789abcdef") {
        return ROOT_PAGE_FIXTURE;
      }

      throw new Error(`Unexpected page read: ${pageId}`);
    }
  }

  class FakeNotionBlockReader implements NotionBlockReader {
    public async fetchBlockChildren(blockId: string): Promise<readonly Record<string, unknown>[]> {
      if (blockId === "01234567-89ab-cdef-0123-456789abcdef") {
        return [LINKED_PARAGRAPH_BLOCK_FIXTURE, CALLOUT_BLOCK_FIXTURE, TABLE_BLOCK_FIXTURE];
      }

      if (blockId === "40404040-4040-4040-4040-404040404040") {
        return [TABLE_ROW_BLOCK_FIXTURE];
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
}

export async function createRichTextOverflowReplaySnapshot(snapshotRoot: string): Promise<void> {
  const overflowingToDoBlock = {
    object: "block",
    id: "88888888-8888-8888-8888-888888888888",
    type: "to_do",
    has_children: false,
    to_do: {
      rich_text: Array.from({ length: 167 }, (_, index) => ({
        type: "text",
        plain_text: `s${index}`,
        href: null,
        text: {
          content: `s${index}`,
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
      })),
      color: "default",
      checked: false,
    },
  };

  class FakeNotionPageReader implements NotionPageReader {
    public async fetchPage(pageId: string): Promise<Record<string, unknown>> {
      if (pageId === "01234567-89ab-cdef-0123-456789abcdef") {
        return ROOT_PAGE_FIXTURE;
      }

      throw new Error(`Unexpected page read: ${pageId}`);
    }
  }

  class FakeNotionBlockReader implements NotionBlockReader {
    public async fetchBlockChildren(blockId: string): Promise<readonly Record<string, unknown>[]> {
      if (blockId === "01234567-89ab-cdef-0123-456789abcdef") {
        return [overflowingToDoBlock];
      }

      return [];
    }
  }

  const noOpDownloader: FileDownloader = {
    download: async () => ({
      bytes: Buffer.from("unused"),
    }),
  };

  const noOpDatabaseReader: NotionDatabaseReader = {
    fetchDatabase: async () => {
      throw new Error("unexpected database fetch");
    },
    fetchDataSource: async () => {
      throw new Error("unexpected data source fetch");
    },
    queryRows: async () => {
      throw new Error("unexpected row query");
    },
  };

  const workflow = new SnapshotWorkflow(
    new FakeNotionPageReader(),
    new FakeNotionBlockReader(),
    noOpDownloader,
    noOpDatabaseReader,
  );

  await workflow.run({
    sourcePage: "0123456789abcdef0123456789abcdef",
    token: "secret_token",
    snapshotRoot,
    compress: false,
    clock: () => "2026-05-13T07:00:00.000Z",
  });
}
