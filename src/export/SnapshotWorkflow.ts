import fs from "node:fs/promises";
import path from "node:path";
import { BlobStore } from "../cas/BlobStore.js";
import { ManifestRepository } from "../cas/ManifestRepository.js";
import { ObjectStore, type StoredObjectRecord } from "../cas/ObjectStore.js";
import type { CanonicalDatabaseDataSource } from "../domain/CanonicalNotionDatabase.js";
import { ContentHash } from "../domain/ContentHash.js";
import { SnapshotManifest } from "../domain/SnapshotManifest.js";
import {
  NotionBlockFactory,
} from "../graph/NotionBlockFactory.js";
import { NotionDatabaseFactory } from "../graph/NotionDatabaseFactory.js";
import { NotionFileFactory } from "../graph/NotionFileFactory.js";
import { NotionPageFactory } from "../graph/NotionPageFactory.js";
import { NotionUnsupportedFactory } from "../graph/NotionUnsupportedFactory.js";
import { SQLiteIndex } from "../mappings/SQLiteIndex.js";
import type { FileDownloader } from "../notion/FileDownloader.js";
import type { NotionDatabaseReader } from "../notion/NotionDatabaseReader.js";
import { NotionId } from "../notion/NotionId.js";
import type { NotionBlockReader } from "../notion/NotionBlockReader.js";
import type { NotionPageReader } from "../notion/NotionPageReader.js";
import {
  NotionRootResolver,
  type NotionRootResolverLike,
} from "../notion/NotionRootResolver.js";
import { ExportReportWriter } from "../reports/ExportReportWriter.js";
import { SnapshotReportPersistence } from "../reports/SnapshotReportPersistence.js";
import { SnapshotArchive } from "../snapshot/SnapshotArchive.js";
import { SnapshotPaths } from "../snapshot/SnapshotPaths.js";
import { FileSystem } from "../util/FileSystem.js";
import { NullProgressReporter, type ProgressReporterLike } from "../app/ProgressReporter.js";
import { ExportRunStatsAccumulator, type ExportRunStats } from "./ExportRunStats.js";

export interface SnapshotWorkflowOptions {
  sourcePage: string;
  token: string;
  snapshotRoot: string;
  compress: boolean;
  clock?: () => string;
}

type ExportTreeResult = { hash: ContentHash } & ExportRunStats;

interface ExportPageResult {
  hash: ContentHash;
  pageCount: number;
  blockCount: number;
  fileCount: number;
  databaseCount: number;
  rowCount: number;
  unsupportedCount: number;
  failureCount: number;
}

interface ExportDatabaseResult {
  hash: ContentHash;
  databaseCount: number;
  rowCount: number;
  pageCount: number;
  blockCount: number;
  fileCount: number;
  unsupportedCount: number;
  failureCount: number;
}

interface FileExportResult {
  contentHash: ContentHash | null;
  failureCount: number;
}

interface ExportContext {
  fetchedAt: string;
  objectStore: ObjectStore;
  blobStore: BlobStore;
  index: SQLiteIndex;
}

interface BlockTreeChildEntry {
  source_id: string;
  ref: string;
}

interface ExportedBlockNodeResult {
  childEntry: BlockTreeChildEntry;
  stats: ExportRunStats;
}

interface ExportedBlockArtifacts {
  nestedChildren: ExportTreeResult | null;
  childPage: ExportPageResult | null;
  childDatabase: ExportDatabaseResult | null;
  fileRef: FileExportResult;
}

interface PageAssetExportResult {
  iconFileRef: ContentHash | null;
  coverFileRef: ContentHash | null;
  propertyFileRefs: Record<string, (string | null)[]>;
  fileCount: number;
  failureCount: number;
}

interface ExportedPageArtifacts {
  pageChildren: ExportTreeResult | null;
  pageAssetFiles: PageAssetExportResult;
}

interface ExportedDatabaseRowResult {
  rowEntry: {
    source_id: string;
    ref: string;
  };
  stats: ExportRunStats;
}

interface ExportedDatabaseRowsResult {
  rowsHash: ContentHash;
  stats: ExportRunStats;
}

interface ExportedDatabaseDataSourceResult {
  canonicalDataSource: CanonicalDatabaseDataSource;
  stats: ExportRunStats;
}

export class SnapshotWorkflow {
  public constructor(
    private readonly pageReader: NotionPageReader,
    private readonly blockReader: NotionBlockReader,
    private readonly fileDownloader: FileDownloader,
    private readonly databaseReader: NotionDatabaseReader,
    private readonly rootResolver: NotionRootResolverLike = new NotionRootResolver(
      pageReader,
      databaseReader,
    ),
    private readonly progressReporter: ProgressReporterLike = new NullProgressReporter(),
  ) {}

  public async run(options: SnapshotWorkflowOptions): Promise<{
    snapshotRoot: string;
    archivePath?: string;
  }> {
    void options.token;

    const now = options.clock ?? (() => new Date().toISOString());
    this.progressReporter.report(`Resolving root: ${options.sourcePage}`);
    const resolvedRoot = await this.rootResolver.resolveRoot(options.sourcePage);
    const rootSourceId = resolvedRoot.sourceId;
    this.progressReporter.report(
      `Resolved root as ${resolvedRoot.kind}: ${resolvedRoot.id}`,
    );

    for (const directory of SnapshotPaths.requiredDirectories(options.snapshotRoot)) {
      await FileSystem.ensureDirectory(directory);
    }

    const manifestRepository = new ManifestRepository(options.snapshotRoot);
    const objectStore = new ObjectStore(options.snapshotRoot);
    const blobStore = new BlobStore(options.snapshotRoot);
    const index = new SQLiteIndex(SnapshotPaths.indexDatabasePath(options.snapshotRoot));
    index.initialize();

    try {
      let manifest = SnapshotManifest.create({
        sourceId: rootSourceId,
        createdAt: now(),
        status: "running",
      }).markIndexCreated();
      await manifestRepository.save(manifest);

      const fetchedAt = now();
      const exportContext: ExportContext = {
        fetchedAt,
        objectStore,
        blobStore,
        index,
      };
      this.progressReporter.report(`Starting export into ${options.snapshotRoot}`);
      const rootPage =
        resolvedRoot.kind === "page"
          ? await this.exportPage(resolvedRoot.id, exportContext)
          : await this.exportDatabase(resolvedRoot.id, exportContext);

      this.progressReporter.report(
        `Finished export root ${resolvedRoot.id}: ${rootPage.pageCount} pages, ${rootPage.blockCount} blocks, ${rootPage.fileCount} files`,
      );

      manifest = manifest
        .withContentHash(rootPage.hash)
        .withCounts({
          pages: rootPage.pageCount,
          blocks: rootPage.blockCount,
          files: rootPage.fileCount,
          databases: rootPage.databaseCount,
          rows: rootPage.rowCount,
          unsupported: rootPage.unsupportedCount,
          failures: rootPage.failureCount,
        })
        .withStatus(
          rootPage.failureCount > 0 || rootPage.unsupportedCount > 0
            ? "complete_with_warnings"
            : "complete",
        );
      await this.writeExportReport(options.snapshotRoot, manifest);
      manifest = manifest.markReportsCreated();
      await manifestRepository.save(manifest);

      if (!options.compress) {
        return {
          snapshotRoot: options.snapshotRoot,
        };
      }

      const archivePath = `${path.resolve(options.snapshotRoot)}.tgz`;
      await fs.rm(archivePath, { force: true });

      manifest = manifest.markCompressed();
      await manifestRepository.save(manifest);
      await SnapshotArchive.compressDirectory(path.resolve(options.snapshotRoot), archivePath);

      return {
        snapshotRoot: options.snapshotRoot,
        archivePath,
      };
    } finally {
      index.close();
    }
  }

  private async writeExportReport(
    snapshotRoot: string,
    manifest: SnapshotManifest,
  ): Promise<void> {
    const report = ExportReportWriter.render({
      rootSourceId: manifest.root.source_id,
      status: manifest.status,
      counts: manifest.toJSON().counts,
    });
    await SnapshotReportPersistence.write(snapshotRoot, "export-report.md", report);
  }

  private async exportBlockTree(
    parentBlockId: string,
    context: ExportContext,
  ): Promise<ExportTreeResult | null> {
    const blocks = await this.blockReader.fetchBlockChildren(parentBlockId);

    if (blocks.length === 0) {
      return null;
    }

    this.progressReporter.report(
      `Exporting ${blocks.length} blocks under ${parentBlockId}`,
    );

    const childEntries: BlockTreeChildEntry[] = [];
    const stats = new ExportRunStatsAccumulator();

    for (const [indexInParent, block] of blocks.entries()) {
      const exportedBlock = await this.exportBlockNode(
        block,
        parentBlockId,
        indexInParent,
        blocks.length,
        context,
      );

      childEntries.push(exportedBlock.childEntry);
      stats.add(exportedBlock.stats);
    }

    const childrenObject = NotionBlockFactory.createChildrenObject(childEntries);
    const childrenHash = await this.storeObject(childrenObject, context);

    return {
      hash: childrenHash,
      ...stats.snapshot(),
    };
  }

  private async exportBlockNode(
    block: Record<string, unknown>,
    parentBlockId: string,
    indexInParent: number,
    siblingCount: number,
    context: ExportContext,
  ): Promise<ExportedBlockNodeResult> {
    const blockId = this.extractString(block, "id", "Notion block payload is missing an id");
    const blockType = NotionBlockFactory.blockTypeOrNull(block) ?? "unknown";
    this.progressReporter.report(
      `Processing block ${indexInParent + 1}/${siblingCount} under ${parentBlockId}: ${blockType} (${blockId})`,
    );

    const exportedArtifacts = await this.exportBlockArtifacts(block, blockId, blockType, context);

    const rawBlock = NotionBlockFactory.createRawBlock(block, context.fetchedAt);
    const rawHash = await this.storeObject(rawBlock, context);
    const isUnsupportedBlock =
      !NotionBlockFactory.isCanonicalizableBlock(block) || blockType === "unsupported";
    const canonicalRecord = this.createCanonicalBlockRecord({
      block,
      blockId,
      blockType,
      rawHash,
      isUnsupportedBlock,
      ...exportedArtifacts,
    });
    const canonicalHash = await this.storeObject(canonicalRecord, context);

    context.index.upsertSourceObject({
      source_id: NotionId.toSourceBlockRef(blockId),
      object_type: canonicalRecord.object_type,
      content_hash: canonicalRecord.content_hash,
      raw_hash: rawBlock.content_hash,
      status: "stored",
      created_at: context.fetchedAt,
    });

    return {
      childEntry: {
        source_id: blockId,
        ref: canonicalHash.toString(),
      },
      stats: this.blockStatsFrom(exportedArtifacts, isUnsupportedBlock),
    };
  }

  private async exportPage(
    pageId: string,
    context: ExportContext,
  ): Promise<ExportPageResult> {
    this.progressReporter.report(`Exporting page ${pageId}`);
    const page = await this.pageReader.fetchPage(pageId);
    const exportedPageArtifacts = await this.exportPageArtifacts(
      pageId,
      page,
      context,
    );
    const rawPage = NotionPageFactory.createRawPage(page, context.fetchedAt);
    const canonicalPage = NotionPageFactory.createCanonicalPage(
      page,
      exportedPageArtifacts.pageChildren?.hash ?? null,
      this.pageCanonicalFileRefs(exportedPageArtifacts.pageAssetFiles),
    );

    await this.storeObject(rawPage, context);
    const canonicalHash = await this.storeObject(canonicalPage, context);
    context.index.upsertSourceObject({
      source_id: NotionId.toSourcePageRef(pageId),
      object_type: canonicalPage.object_type,
      content_hash: canonicalPage.content_hash,
      raw_hash: rawPage.content_hash,
      status: "stored",
      created_at: context.fetchedAt,
    });

    return {
      hash: canonicalHash,
      ...this.pageStatsFrom(exportedPageArtifacts),
    };
  }

  private async exportDatabase(
    databaseId: string,
    context: ExportContext,
  ): Promise<ExportDatabaseResult> {
    this.progressReporter.report(`Exporting database ${databaseId}`);
    const database = await this.databaseReader.fetchDatabase(databaseId);
    const rawDatabase = NotionDatabaseFactory.createRawDatabase(database, context.fetchedAt);
    await this.storeObject(rawDatabase, context);
    const exportedDataSources = await this.exportDatabaseDataSources(
      databaseId,
      database,
      context,
    );
    const canonicalDataSources = exportedDataSources.map(
      ({ canonicalDataSource }) => canonicalDataSource,
    );
    const primaryDataSource = canonicalDataSources[0];
    if (!primaryDataSource) {
      throw new Error(`Database ${databaseId} did not export any data sources`);
    }
    const canonicalDatabase = NotionDatabaseFactory.createDatabase(
      database,
      ContentHash.parse(primaryDataSource.schema_ref),
      ContentHash.parse(primaryDataSource.rows_ref),
      canonicalDataSources,
    );
    const databaseHash = await this.storeObject(canonicalDatabase, context);

    context.index.upsertSourceObject({
      source_id: NotionId.toSourceDatabaseRef(databaseId),
      object_type: canonicalDatabase.object_type,
      content_hash: canonicalDatabase.content_hash,
      raw_hash: rawDatabase.content_hash,
      status: "stored",
      created_at: context.fetchedAt,
    });

    const aggregatedStats = this.aggregateExportStats(
      exportedDataSources.map(({ stats }) => stats),
    );

    return {
      hash: databaseHash,
      databaseCount: 1,
      rowCount: aggregatedStats.rowCount,
      pageCount: aggregatedStats.pageCount,
      blockCount: aggregatedStats.blockCount,
      fileCount: aggregatedStats.fileCount,
      unsupportedCount: aggregatedStats.unsupportedCount,
      failureCount: aggregatedStats.failureCount,
    };
  }

  private async exportPageArtifacts(
    pageId: string,
    page: Record<string, unknown>,
    context: ExportContext,
  ): Promise<ExportedPageArtifacts> {
    return {
      pageChildren: await this.exportBlockTree(pageId, context),
      pageAssetFiles: await this.exportFileRefsForPage(page, context),
    };
  }

  private pageCanonicalFileRefs(pageAssetFiles: PageAssetExportResult): {
    icon: string | null;
    cover: string | null;
    properties: Record<string, (string | null)[]>;
  } {
    return {
      icon: pageAssetFiles.iconFileRef?.toString() ?? null,
      cover: pageAssetFiles.coverFileRef?.toString() ?? null,
      properties: pageAssetFiles.propertyFileRefs,
    };
  }

  private pageStatsFrom(exportedPageArtifacts: ExportedPageArtifacts): Omit<ExportPageResult, "hash"> {
    const pageChildren = exportedPageArtifacts.pageChildren;
    return {
      pageCount: 1 + this.exportStat(pageChildren, "pageCount"),
      blockCount: this.exportStat(pageChildren, "blockCount"),
      fileCount: this.exportStat(pageChildren, "fileCount") + exportedPageArtifacts.pageAssetFiles.fileCount,
      databaseCount: this.exportStat(pageChildren, "databaseCount"),
      rowCount: this.exportStat(pageChildren, "rowCount"),
      unsupportedCount: this.exportStat(pageChildren, "unsupportedCount"),
      failureCount:
        this.exportStat(pageChildren, "failureCount") +
        exportedPageArtifacts.pageAssetFiles.failureCount,
    };
  }

  private async exportDatabaseDataSources(
    databaseId: string,
    database: Record<string, unknown>,
    context: ExportContext,
  ): Promise<ExportedDatabaseDataSourceResult[]> {
    const exportedDataSources: ExportedDatabaseDataSourceResult[] = [];

    for (const dataSourceEntry of this.extractDataSourceEntries(database)) {
      exportedDataSources.push(
        await this.exportDatabaseDataSource(databaseId, dataSourceEntry, context),
      );
    }

    return exportedDataSources;
  }

  private async exportDatabaseDataSource(
    databaseId: string,
    dataSourceEntry: { id: string; name: string },
    context: ExportContext,
  ): Promise<ExportedDatabaseDataSourceResult> {
    const dataSource = await this.databaseReader.fetchDataSource(dataSourceEntry.id);
    const rawDataSource = NotionDatabaseFactory.createRawDataSource(dataSource, context.fetchedAt);
    await this.storeObject(rawDataSource, context);
    const schema = NotionDatabaseFactory.createDatabaseSchema(dataSource);
    const schemaHash = await this.storeObject(schema, context);
    const exportedRows = await this.exportDatabaseRows(databaseId, dataSourceEntry, context);

    return {
      canonicalDataSource: {
        source_id: dataSourceEntry.id,
        name: dataSourceEntry.name,
        schema_ref: schemaHash.toString(),
        rows_ref: exportedRows.rowsHash.toString(),
      },
      stats: exportedRows.stats,
    };
  }

  private async exportDatabaseRows(
    databaseId: string,
    dataSourceEntry: { id: string; name: string },
    context: ExportContext,
  ): Promise<ExportedDatabaseRowsResult> {
    const queriedRows = await this.databaseReader.queryRows(dataSourceEntry.id);
    this.progressReporter.report(
      `Exporting ${queriedRows.length} rows from data source ${dataSourceEntry.id} for database ${databaseId}`,
    );
    const rowEntries: { source_id: string; ref: string }[] = [];
    const stats = new ExportRunStatsAccumulator();

    for (const [rowIndex, rowPage] of queriedRows.entries()) {
      const exportedRow = await this.exportDatabaseRow(
        databaseId,
        dataSourceEntry.id,
        rowPage,
        rowIndex,
        queriedRows.length,
        context,
      );
      rowEntries.push(exportedRow.rowEntry);
      stats.add(exportedRow.stats);
    }

    const rowsObject = NotionBlockFactory.createChildrenObject(rowEntries);

    return {
      rowsHash: await this.storeObject(rowsObject, context),
      stats: stats.snapshot(),
    };
  }

  private async exportDatabaseRow(
    databaseId: string,
    dataSourceId: string,
    rowPage: Record<string, unknown>,
    rowIndex: number,
    rowCount: number,
    context: ExportContext,
  ): Promise<ExportedDatabaseRowResult> {
    const rowPageId = this.extractString(rowPage, "id", "Notion row page is missing an id");
    this.progressReporter.report(
      `Processing row ${rowIndex + 1}/${rowCount} for data source ${dataSourceId}: ${rowPageId}`,
    );
    const exportedRowPage = await this.exportPage(rowPageId, context);
    const row = NotionDatabaseFactory.createDatabaseRow(
      rowPage,
      databaseId,
      exportedRowPage.hash,
      await this.exportedPageProperties(exportedRowPage.hash, context),
    );
    const rowHash = await this.storeObject(row, context);

    return {
      rowEntry: {
        source_id: rowPageId,
        ref: rowHash.toString(),
      },
      stats: this.databaseRowStatsFrom(exportedRowPage),
    };
  }

  private async exportedPageProperties(
    pageHash: ContentHash,
    context: ExportContext,
  ): Promise<Record<string, unknown>> {
    const exportedRowPageRecord = await context.objectStore.get<{
      canonical: {
        properties: Record<string, unknown>;
      };
    }>(pageHash);

    return exportedRowPageRecord.canonical.properties;
  }

  private databaseRowStatsFrom(exportedRowPage: ExportPageResult): ExportRunStats {
    return {
      blockCount: exportedRowPage.blockCount,
      fileCount: exportedRowPage.fileCount,
      pageCount: exportedRowPage.pageCount,
      databaseCount: exportedRowPage.databaseCount,
      rowCount: exportedRowPage.rowCount + 1,
      unsupportedCount: exportedRowPage.unsupportedCount,
      failureCount: exportedRowPage.failureCount,
    };
  }

  private aggregateExportStats(
    statsEntries: readonly ExportRunStats[],
  ): ExportRunStats {
    const stats = new ExportRunStatsAccumulator();

    for (const entry of statsEntries) {
      stats.add(entry);
    }

    return stats.snapshot();
  }

  private async exportFileForBlock(
    block: Record<string, unknown>,
    context: ExportContext,
  ): Promise<FileExportResult> {
    const blockType = NotionBlockFactory.blockTypeOrNull(block);

    if (!blockType) {
      return { contentHash: null, failureCount: 0 };
    }

    const blockId = this.extractString(block, "id", "Notion file block payload is missing an id");

    return this.exportFileRefFromPayload(
      {
        sourceId: blockId,
        filePayload: block[blockType],
        originalBlockType: blockType,
        fallbackName: blockType,
      },
      context,
    );
  }

  private async exportFileRefsForPage(
    page: Record<string, unknown>,
    context: ExportContext,
  ): Promise<PageAssetExportResult> {
    const pageId = this.extractString(page, "id", "Notion page payload is missing an id");
    const properties = this.pageProperties(page);
    const iconFileRef = await this.exportNamedPageAsset(
      pageId,
      "icon",
      this.pick(page, "icon"),
      "page_icon",
      "page-icon",
      context,
    );
    const coverFileRef = await this.exportNamedPageAsset(
      pageId,
      "cover",
      this.pick(page, "cover"),
      "page_cover",
      "page-cover",
      context,
    );
    const propertyAssets = await this.exportPagePropertyFiles(pageId, properties, context);

    return {
      iconFileRef: iconFileRef.contentHash,
      coverFileRef: coverFileRef.contentHash,
      propertyFileRefs: propertyAssets.propertyFileRefs,
      fileCount:
        (iconFileRef.contentHash ? 1 : 0) +
        (coverFileRef.contentHash ? 1 : 0) +
        propertyAssets.fileCount,
      failureCount: iconFileRef.failureCount + coverFileRef.failureCount + propertyAssets.failureCount,
    };
  }

  private async exportFileRefFromPayload(
    input: {
      sourceId: string;
      filePayload: unknown;
      originalBlockType: string;
      fallbackName: string;
    },
    context: ExportContext,
  ): Promise<FileExportResult> {
    const url = NotionFileFactory.extractFileUrlFromValue(input.filePayload);

    if (!url) {
      return { contentHash: null, failureCount: 0 };
    }

    try {
      this.progressReporter.report(`Downloading file blob: ${url}`);
      const downloaded = await this.fileDownloader.download(url);
      const blobHash = ContentHash.fromBytes(downloaded.bytes);
      const mimeType = downloaded.mimeType ?? "application/octet-stream";

      await context.blobStore.put(blobHash, downloaded.bytes);
      context.index.upsertBlobStore({
        blob_hash: blobHash.toString(),
        path: SnapshotPaths.relativeBlobPath(blobHash),
        size_bytes: downloaded.bytes.byteLength,
        mime_type: mimeType,
        created_at: context.fetchedAt,
      });

      const fileRef = NotionFileFactory.createFileRefFromPayload({
        sourceId: input.sourceId,
        filePayload: input.filePayload,
        blobHash,
        mimeType,
        sizeBytes: downloaded.bytes.byteLength,
        originalBlockType: input.originalBlockType,
        fallbackName: input.fallbackName,
      });
      const contentHash = await this.storeObject(fileRef, context);

      return { contentHash, failureCount: 0 };
    } catch {
      this.progressReporter.report(`File download failed: ${url}`);
      return { contentHash: null, failureCount: 1 };
    }
  }

  private async storeObject(
    record: StoredObjectRecord,
    context: ExportContext,
  ): Promise<ContentHash> {
    const { hash } = await context.objectStore.put(record);

    context.index.upsertObjectStore({
      content_hash: record.content_hash,
      object_type: record.object_type,
      path: SnapshotPaths.relativeObjectPath(hash),
      size_bytes: Buffer.byteLength(JSON.stringify(record)),
      created_at: context.fetchedAt,
    });

    return hash;
  }

  private async exportBlockArtifacts(
    block: Record<string, unknown>,
    blockId: string,
    blockType: string,
    context: ExportContext,
  ): Promise<ExportedBlockArtifacts> {
    return {
      nestedChildren: await this.exportNestedChildren(block, blockId, context),
      childPage: await this.exportChildPageArtifact(blockType, blockId, context),
      childDatabase: await this.exportChildDatabaseArtifact(blockType, blockId, context),
      fileRef: await this.exportFileForBlock(block, context),
    };
  }

  private createCanonicalBlockRecord(input: {
    block: Record<string, unknown>;
    blockId: string;
    blockType: string;
    rawHash: ContentHash;
    nestedChildren: ExportTreeResult | null;
    childPage: ExportPageResult | null;
    childDatabase: ExportDatabaseResult | null;
    fileRef: FileExportResult;
    isUnsupportedBlock: boolean;
  }): StoredObjectRecord {
    if (input.isUnsupportedBlock) {
      return this.createUnsupportedCanonicalBlockRecord(input);
    }

    return this.createSupportedCanonicalBlockRecord(input);
  }

  private blockStatsFrom(
    exportedArtifacts: ExportedBlockArtifacts,
    isUnsupportedBlock: boolean,
  ): ExportRunStats {
    const stats = new ExportRunStatsAccumulator();
    stats.add(exportedArtifacts.nestedChildren);
    stats.add(exportedArtifacts.childPage);
    stats.add(exportedArtifacts.childDatabase);
    stats.add({
      blockCount: 1,
      fileCount: exportedArtifacts.fileRef.contentHash ? 1 : 0,
      unsupportedCount: isUnsupportedBlock ? 1 : 0,
      failureCount: exportedArtifacts.fileRef.failureCount,
    });
    return stats.snapshot();
  }

  private pageProperties(page: Record<string, unknown>): Record<string, unknown> {
    const properties = this.pick(page, "properties");
    return properties && typeof properties === "object"
      ? (properties as Record<string, unknown>)
      : {};
  }

  private exportStat(
    value: ExportTreeResult | null,
    key: keyof ExportRunStats,
  ): number {
    return value?.[key] ?? 0;
  }

  private async exportNestedChildren(
    block: Record<string, unknown>,
    blockId: string,
    context: ExportContext,
  ): Promise<ExportTreeResult | null> {
    return this.extractBoolean(block, "has_children")
      ? await this.exportBlockTree(blockId, context)
      : null;
  }

  private async exportChildPageArtifact(
    blockType: string,
    blockId: string,
    context: ExportContext,
  ): Promise<ExportPageResult | null> {
    return blockType === "child_page" ? await this.exportPage(blockId, context) : null;
  }

  private async exportChildDatabaseArtifact(
    blockType: string,
    blockId: string,
    context: ExportContext,
  ): Promise<ExportDatabaseResult | null> {
    return blockType === "child_database" ? await this.exportDatabase(blockId, context) : null;
  }

  private createUnsupportedCanonicalBlockRecord(input: {
    block: Record<string, unknown>;
    blockId: string;
    blockType: string;
    rawHash: ContentHash;
    nestedChildren: ExportTreeResult | null;
    childPage: ExportPageResult | null;
    childDatabase: ExportDatabaseResult | null;
    fileRef: FileExportResult;
    isUnsupportedBlock: boolean;
  }): StoredObjectRecord {
    return NotionUnsupportedFactory.createUnsupportedBlock({
      blockId: input.blockId,
      originalType: input.blockType,
      reason: input.blockType === "unsupported" ? "unsupported_in_mvp" : "partial_block_payload",
      rawRef: input.rawHash.toString(),
      childrenRef: input.nestedChildren?.hash.toString() ?? null,
    });
  }

  private createSupportedCanonicalBlockRecord(input: {
    block: Record<string, unknown>;
    blockId: string;
    blockType: string;
    rawHash: ContentHash;
    nestedChildren: ExportTreeResult | null;
    childPage: ExportPageResult | null;
    childDatabase: ExportDatabaseResult | null;
    fileRef: FileExportResult;
    isUnsupportedBlock: boolean;
  }): StoredObjectRecord {
    return NotionBlockFactory.createCanonicalBlock(
      input.block,
      input.nestedChildren?.hash ?? null,
      input.fileRef.contentHash?.toString() ?? null,
      input.childPage?.hash.toString() ?? null,
      input.childDatabase?.hash.toString() ?? null,
    );
  }

  private async exportNamedPageAsset(
    pageId: string,
    assetName: "icon" | "cover",
    asset: unknown,
    originalBlockType: string,
    fallbackName: string,
    context: ExportContext,
  ): Promise<FileExportResult> {
    if (this.pick(asset, "type") !== "file") {
      return { contentHash: null, failureCount: 0 };
    }

    return this.exportFileRefFromPayload(
      {
        sourceId: `${pageId}:${assetName}`,
        filePayload: asset,
        originalBlockType,
        fallbackName,
      },
      context,
    );
  }

  private async exportPagePropertyFiles(
    pageId: string,
    properties: Record<string, unknown>,
    context: ExportContext,
  ): Promise<{
    propertyFileRefs: Record<string, (string | null)[]>;
    fileCount: number;
    failureCount: number;
  }> {
    const propertyFileRefs: Record<string, (string | null)[]> = {};
    let fileCount = 0;
    let failureCount = 0;

    for (const [propertyName, propertyValue] of Object.entries(properties)) {
      const fileValues = this.pagePropertyFileValues(propertyValue);

      if (!fileValues) {
        continue;
      }

      propertyFileRefs[propertyName] = [];

      for (const [indexInProperty, fileValue] of fileValues.entries()) {
        const fileRef = await this.exportFileRefFromPayload(
          {
            sourceId: `${pageId}:property:${propertyName}:${indexInProperty}`,
            filePayload: fileValue,
            originalBlockType: "page_property_file",
            fallbackName: `${propertyName}-${indexInProperty + 1}`,
          },
          context,
        );
        propertyFileRefs[propertyName].push(fileRef.contentHash?.toString() ?? null);
        fileCount += fileRef.contentHash ? 1 : 0;
        failureCount += fileRef.failureCount;
      }
    }

    return { propertyFileRefs, fileCount, failureCount };
  }

  private pagePropertyFileValues(propertyValue: unknown): readonly unknown[] | null {
    if (!propertyValue || typeof propertyValue !== "object") {
      return null;
    }

    const fileProperty = propertyValue as Record<string, unknown>;
    return fileProperty.type === "files" && Array.isArray(fileProperty.files)
      ? (fileProperty.files as readonly unknown[])
      : null;
  }

  private extractBoolean(value: unknown, key: string): boolean {
    if (!value || typeof value !== "object") {
      return false;
    }

    return Boolean((value as Record<string, unknown>)[key]);
  }

  private extractString(value: unknown, key: string, errorMessage: string): string {
    if (!value || typeof value !== "object") {
      throw new Error(errorMessage);
    }

    const extracted = (value as Record<string, unknown>)[key];

    if (typeof extracted !== "string" || extracted.length === 0) {
      throw new Error(errorMessage);
    }

    return extracted;
  }

  private pick(value: unknown, key: string): unknown {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    return (value as Record<string, unknown>)[key];
  }

  private extractDataSourceEntries(database: Record<string, unknown>): { id: string; name: string }[] {
    const dataSources = this.pick(database, "data_sources");

    if (!Array.isArray(dataSources) || dataSources.length === 0) {
      throw new Error("Notion database is missing a data source id");
    }

    return dataSources.map((dataSource, index) => ({
      id: this.extractString(dataSource, "id", "Notion database is missing a data source id"),
      name:
        typeof this.pick(dataSource, "name") === "string" && String(this.pick(dataSource, "name")).length > 0
          ? String(this.pick(dataSource, "name"))
          : `Data Source ${index + 1}`,
    }));
  }
}
