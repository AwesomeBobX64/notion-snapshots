import type { BlockObjectRequest } from "@notionhq/client";
import { ContentHash } from "../domain/ContentHash.js";
import {
  primaryCanonicalDatabaseDataSource,
  type LoadedCanonicalDatabase,
  type LoadedCanonicalDatabaseRow,
  type LoadedCanonicalDatabaseSchema,
} from "../domain/CanonicalNotionDatabase.js";
import type { ObjectStore } from "../cas/ObjectStore.js";
import type { DestinationObjectMappings } from "../mappings/DestinationObjectMappings.js";
import type { DestinationBlockWriter } from "../notion/DestinationBlockWriter.js";
import type { DestinationDatabaseWriter } from "../notion/DestinationDatabaseWriter.js";
import type { DestinationFileUploader } from "../notion/DestinationFileUploader.js";
import type { DestinationPageWriter } from "../notion/DestinationPageWriter.js";
import { NotionId } from "../notion/NotionId.js";
import { NotionPagePropertyCodec } from "../notion/NotionPagePropertyCodec.js";
import { ImportReportWriter } from "../reports/ImportReportWriter.js";
import { SnapshotReportPersistence } from "../reports/SnapshotReportPersistence.js";
import {
  SnapshotLoader,
  type LoadedBlockNode,
  type LoadedChildren,
  type LoadedCanonicalPage,
  type LoadedUnsupportedBlock,
} from "../snapshot/SnapshotLoader.js";
import { withSnapshotOperationSession } from "../snapshot/SnapshotOperationSession.js";
import { NullProgressReporter, type ProgressReporterLike } from "../app/ProgressReporter.js";
import { NotionBlockRequestFactory } from "./NotionBlockRequestFactory.js";
import { NotionDatabaseRequestFactory } from "./NotionDatabaseRequestFactory.js";
import { ImportPlanner } from "./ImportPlanner.js";
import { ImportRunStats } from "./ImportRunStats.js";
import { PreparedImportAssetResolver } from "./PreparedImportAssetResolver.js";

export interface ImportWorkflowOptions {
  snapshotPath: string;
  targetPageId: string;
  clock?: () => string;
}

export interface ImportWorkflowResult {
  createdPages: number;
  createdBlocks: number;
  transformedBlocks: number;
  skippedBlocks: number;
  uploadedFiles: number;
  failures: number;
}

interface PlannedPageTask {
  inputs: {
    parent_source_id: string | null;
    source_id: string;
    title: string;
  };
}

interface CanonicalLoadedBlockNode {
  block: Exclude<LoadedBlockNode["block"], LoadedUnsupportedBlock>;
  children: LoadedBlockNode[];
}

interface UnsupportedLoadedBlockNode {
  block: LoadedUnsupportedBlock;
  children: LoadedBlockNode[];
}

interface PreparedReplayBlock {
  request: BlockObjectRequest | null;
  uploadedFiles: number;
  appendsChildrenInline: boolean;
}

interface ImportContext {
  objectStore: ObjectStore;
  assetResolver: PreparedImportAssetResolver;
  destinationMappings: DestinationObjectMappings;
  clock: (() => string) | undefined;
  stats: ImportRunStats;
}

export class ImportWorkflow {
  private readonly snapshotLoader: SnapshotLoader;
  private readonly planner: ImportPlanner;
  private readonly progressReporter: ProgressReporterLike;
  private readonly fileUploader: DestinationFileUploader | undefined;
  private readonly databaseWriter: DestinationDatabaseWriter | undefined;

  public constructor(
    private readonly pageWriter: DestinationPageWriter,
    private readonly blockWriter: DestinationBlockWriter,
    options?: {
      databaseWriter?: DestinationDatabaseWriter;
      fileUploader?: DestinationFileUploader;
      snapshotLoader?: SnapshotLoader;
      planner?: ImportPlanner;
      progressReporter?: ProgressReporterLike;
    },
  ) {
    this.databaseWriter = options?.databaseWriter;
    this.fileUploader = options?.fileUploader;
    this.snapshotLoader = options?.snapshotLoader ?? new SnapshotLoader();
    this.planner = options?.planner ?? new ImportPlanner();
    this.progressReporter = options?.progressReporter ?? new NullProgressReporter();
  }

  public async run(options: ImportWorkflowOptions): Promise<ImportWorkflowResult> {
    return withSnapshotOperationSession(
      {
        snapshotPath: options.snapshotPath,
        snapshotLoader: this.snapshotLoader,
      },
      async ({ snapshot, objectStore, blobStore, destinationMappings }) => {
        const assetResolver = new PreparedImportAssetResolver(
          this.fileUploader,
          objectStore,
          blobStore,
        );
        const targetPageId = NotionId.parsePageId(options.targetPageId);
        const plan = this.planner.planPageShellImport(snapshot);
        const stats = new ImportRunStats();
        const pagesBySourceId = new Map(snapshot.pages.map((page) => [page.source.id, page]));
        const context: ImportContext = {
          objectStore,
          assetResolver,
          destinationMappings,
          clock: options.clock,
          stats,
        };

        if (snapshot.rootDatabase) {
          await this.importDatabase(
            snapshot.rootDatabase,
            targetPageId,
            snapshot.rootDatabase.content_hash,
            context,
            false,
          );
        }

        for (const task of plan.tasks) {
          try {
            await this.createPageShellForTask(task, pagesBySourceId, targetPageId, context);
          } catch (error) {
            stats.recordFailure("page_shell");
            this.progressReporter.report(
              `Import failure while creating page shell ${task.inputs.source_id}: ${this.errorMessage(error)}`,
            );
          }
        }

        for (const task of plan.tasks) {
          try {
            await this.replayPlannedPage(task, pagesBySourceId, snapshot.pageBlocks, context);
          } catch (error) {
            stats.recordFailure("page_replay");
            this.progressReporter.report(
              `Import failure while replaying page ${task.inputs.source_id}: ${this.errorMessage(error)}`,
            );
          }
        }

        await this.writeImportReport(snapshot.snapshotRoot, stats.toReportSummary(targetPageId));

        return stats.toResult();
      },
    );
  }

  private async replayBlocksForPage(
    destinationPageId: string,
    blocks: LoadedBlockNode[],
    context: ImportContext,
  ): Promise<void> {
    for (const blockNode of blocks) {
      try {
        await this.replayBlockNode(blockNode, destinationPageId, context);
      } catch (error) {
        context.stats.recordFailure("block_replay");
        this.progressReporter.report(
          `Import failure while replaying block tree under ${destinationPageId}: ${this.errorMessage(error)}`,
        );
      }
    }
  }

  private async replayBlockNode(
    node: LoadedBlockNode,
    parentId: string,
    context: ImportContext,
  ): Promise<void> {
    if (node.block.object_type !== "notion.block") {
      this.skipUnsupportedNode(node as UnsupportedLoadedBlockNode, context.stats);
      return;
    }

    const canonicalNode = this.asCanonicalBlockNode(node);

    if (await this.handleTransformedBlockNode(canonicalNode, parentId, context)) {
      return;
    }

    const preparedReplay = await this.prepareReplayBlock(canonicalNode, context.assetResolver);

    if (!preparedReplay.request) {
      this.skipUnsupportedImportBlock(node, canonicalNode, preparedReplay.uploadedFiles, context.stats);
      return;
    }

    this.progressReporter.report(
      `Appending ${node.block.canonical.block_type} block under ${parentId}`,
    );

    const destinationBlockId = await this.blockWriter.appendBlock({
      parentId,
      block: preparedReplay.request,
    });

    context.destinationMappings.recordBlock(node.block.source.id, {
      destinationId: destinationBlockId,
      contentHash: canonicalNode.block.content_hash,
      status: "replayed",
      createdAt: this.timestamp(context.clock),
    });

    context.stats.recordCreatedBlocks(preparedReplay.appendsChildrenInline ? this.countNodes(node) : 1);
    context.stats.recordUploadedFiles(preparedReplay.uploadedFiles);

    if (preparedReplay.appendsChildrenInline) {
      // Table rows are created inline with the parent table, so the API only gives
      // us the parent table id back here. We preserve the row content, but do not
      // currently record individual destination ids for each table_row child.
      return;
    }

    await this.replayChildBlocks(canonicalNode.children, destinationBlockId, context);
  }

  private async importChildDatabaseNode(
    node: CanonicalLoadedBlockNode,
    parentId: string,
    context: ImportContext,
  ): Promise<void> {
    if (!this.databaseWriter) {
      context.stats.recordSkippedType("child_database");
      context.stats.recordSkippedBlocks(1);
      return;
    }

    const databaseRef = node.block.canonical.payload.database_ref;

    if (typeof databaseRef !== "string") {
      context.stats.recordSkippedType("child_database");
      context.stats.recordSkippedBlocks(1);
      return;
    }

    const database = await context.objectStore.get<LoadedCanonicalDatabase>(ContentHash.parse(databaseRef));
    await this.importDatabase(
      database,
      parentId,
      databaseRef,
      context,
      true,
    );

    this.progressReporter.report(
      `Preserving child database via database transformation (${node.block.source.id})`,
    );
  }

  private countNodes(node: LoadedBlockNode): number {
    return 1 + node.children.reduce((count, child) => count + this.countNodes(child), 0);
  }

  private async maybeCreateUploadedFileBlock(
    node: CanonicalLoadedBlockNode,
    assetResolver: PreparedImportAssetResolver,
  ): Promise<{ request: BlockObjectRequest } | null> {
    if (!this.fileUploader || !["image", "file", "pdf"].includes(node.block.canonical.block_type)) {
      return null;
    }

    const fileRefHash = node.block.canonical.payload.file_ref;

    if (typeof fileRefHash !== "string") {
      return null;
    }

    const uploaded = await assetResolver.uploadPreparedFileRef(fileRefHash);

    if (!uploaded) {
      return null;
    }

    const request = NotionBlockRequestFactory.fromCanonicalUploadedFileBlock(
      node.block,
      uploaded.fileUploadId,
      uploaded.name,
    );

    if (!request) {
      return null;
    }

    this.progressReporter.report(
      `Uploaded file for ${node.block.canonical.block_type} block ${node.block.source.id}`,
    );

    return { request };
  }

  private async preparePageShellInput(
    page: LoadedCanonicalPage,
    assetResolver: PreparedImportAssetResolver,
  ): Promise<{
    properties: Record<string, unknown>;
    icon: Record<string, unknown> | null;
    cover: Record<string, unknown> | null;
    uploadedFiles: number;
  }> {
    const preparedProperties = await this.preparePropertiesForCreate(page.canonical.properties, assetResolver);
    const preparedIcon = await assetResolver.preparePageAssetForCreate(page.canonical.icon);
    const preparedCover = await assetResolver.preparePageAssetForCreate(page.canonical.cover);

    return {
      properties: NotionPagePropertyCodec.propertiesForCreate({
        title: page.canonical.title,
        properties: preparedProperties.properties,
      }),
      icon: preparedIcon.asset,
      cover: preparedCover.asset,
      uploadedFiles:
        preparedProperties.uploadedFiles + preparedIcon.uploadedFiles + preparedCover.uploadedFiles,
    };
  }

  private async preparePropertiesForCreate(
    properties: Record<string, unknown>,
    assetResolver: PreparedImportAssetResolver,
  ): Promise<{
    properties: Record<string, unknown>;
    uploadedFiles: number;
  }> {
    const preparedProperties = structuredClone(properties);
    let uploadedFiles = 0;

    for (const propertyValue of Object.values(preparedProperties)) {
      uploadedFiles += await this.rewriteFilesPropertyForCreate(propertyValue, assetResolver);
    }

    return {
      properties: preparedProperties,
      uploadedFiles,
    };
  }

  private async writeImportReport(
    snapshotRoot: string,
    summary: {
      targetPageId: string;
      createdPages: number;
      createdBlocks: number;
      uploadedFiles: number;
      preservedWithTransformation: number;
      skippedUnsupported: number;
      failures: number;
      skippedByType: Record<string, number>;
      failuresByType: Record<string, number>;
    },
  ): Promise<void> {
    const report = ImportReportWriter.render(summary);
    await SnapshotReportPersistence.write(snapshotRoot, "import-report.md", report);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async importDatabase(
    database: LoadedCanonicalDatabase,
    parentId: string,
    contentHash: string,
    context: ImportContext,
    isTransformation: boolean,
  ): Promise<void> {
    if (!this.databaseWriter) {
      context.stats.recordSkippedType("child_database");
      context.stats.recordSkippedBlocks(1);
      return;
    }

    const primaryDataSource = primaryCanonicalDatabaseDataSource(database);
    const schema = await context.objectStore.get<LoadedCanonicalDatabaseSchema>(
      ContentHash.parse(primaryDataSource.schema_ref),
    );
    const dataSourceCount = database.canonical.data_sources?.length ?? 0;

    if (dataSourceCount > 1) {
      this.progressReporter.report(
        `Importing primary data source only for database ${database.source.id}; preserving ${dataSourceCount - 1} additional data source(s) canonically`,
      );
    }

    const destinationDatabase = await this.databaseWriter.createInlineDatabase({
      parentPageId: parentId,
      title: NotionDatabaseRequestFactory.titleForDatabase(database),
      description: NotionDatabaseRequestFactory.descriptionForDatabase(database),
      properties: NotionDatabaseRequestFactory.propertiesForSchema(schema),
    });

    context.destinationMappings.recordDatabase(database.source.id, {
      destinationId: destinationDatabase.databaseId,
      contentHash,
      status: "created_database",
      createdAt: this.timestamp(context.clock),
    });

    const rows = await context.objectStore.get<LoadedChildren>(ContentHash.parse(primaryDataSource.rows_ref));

    for (const rowEntry of rows.children) {
      try {
        const row = await context.objectStore.get<LoadedCanonicalDatabaseRow>(ContentHash.parse(rowEntry.ref));
        const rowPage = await context.objectStore.get<LoadedCanonicalPage>(ContentHash.parse(row.canonical.page_ref));
        const preparedRowProperties = await this.preparePropertiesForCreate(
          row.canonical.properties,
          context.assetResolver,
        );
        const destinationRowPageId = await this.databaseWriter.createRowPage({
          dataSourceId: destinationDatabase.dataSourceId,
          properties: NotionDatabaseRequestFactory.propertiesForRow({
            source: row.source,
            canonical: {
              properties: preparedRowProperties.properties,
              page_ref: row.canonical.page_ref,
            },
          }),
        });

        context.destinationMappings.recordPage(row.source.id, {
          destinationId: destinationRowPageId,
          contentHash: row.canonical.page_ref,
          status: "created_database_row",
          createdAt: this.timestamp(context.clock),
        });

        context.stats.recordCreatedPages();
        context.stats.recordUploadedFiles(preparedRowProperties.uploadedFiles);

        const rowBlocks = rowPage.canonical.children_ref
          ? await this.snapshotLoader.loadBlockNodes(rowPage.canonical.children_ref, context.objectStore)
          : [];
        await this.replayBlocksForPage(
          destinationRowPageId,
          rowBlocks,
          context,
        );
      } catch (error) {
        context.stats.recordFailure("database_row");
        this.progressReporter.report(
          `Import failure while recreating database row ${rowEntry.source_id}: ${this.errorMessage(error)}`,
        );
      }
    }

    if (isTransformation) {
      context.stats.recordTransformedBlocks();
    }
  }

  private async createPageShellForTask(
    task: PlannedPageTask,
    pagesBySourceId: ReadonlyMap<string, LoadedCanonicalPage>,
    targetPageId: string,
    context: ImportContext,
  ): Promise<void> {
    const parentId = this.parentIdForTask(task, targetPageId, context.destinationMappings);

    if (!parentId) {
      throw new Error(`Missing destination parent mapping for ${task.inputs.source_id}`);
    }

    const sourcePage = this.requireSourcePage(task.inputs.source_id, pagesBySourceId);
    this.progressReporter.report(`Creating page shell for "${task.inputs.title}"`);

    const preparedPageShell = await this.preparePageShellInput(sourcePage, context.assetResolver);
    const destinationId = await this.pageWriter.createPageShell({
      parentId,
      title: task.inputs.title,
      properties: preparedPageShell.properties,
      icon: preparedPageShell.icon,
      cover: preparedPageShell.cover,
    });

    context.destinationMappings.recordPage(task.inputs.source_id, {
      destinationId,
      contentHash: sourcePage.content_hash,
      status: "created_shell",
      createdAt: this.timestamp(context.clock),
    });

    context.stats.recordCreatedPages();
    context.stats.recordUploadedFiles(preparedPageShell.uploadedFiles);
  }

  private async replayPlannedPage(
    task: PlannedPageTask,
    pagesBySourceId: ReadonlyMap<string, LoadedCanonicalPage>,
    pageBlocks: ReadonlyMap<string, LoadedBlockNode[]>,
    context: ImportContext,
  ): Promise<void> {
    const sourcePage = this.requireSourcePage(task.inputs.source_id, pagesBySourceId);
    const destinationPageId = context.destinationMappings.pageIdFor(sourcePage.source.id);

    if (!destinationPageId) {
      throw new Error(`Missing destination page mapping for ${sourcePage.source.id}`);
    }

    this.progressReporter.report(`Replaying blocks for page "${ImportPlanner.titleFor(sourcePage)}"`);
    await this.replayBlocksForPage(
      destinationPageId,
      pageBlocks.get(sourcePage.source.id) ?? [],
      context,
    );
  }

  private parentIdForTask(
    task: PlannedPageTask,
    targetPageId: string,
    destinationMappings: DestinationObjectMappings,
  ): string | undefined {
    return task.inputs.parent_source_id === null
      ? targetPageId
      : destinationMappings.pageIdFor(task.inputs.parent_source_id);
  }

  private requireSourcePage(
    sourcePageId: string,
    pagesBySourceId: ReadonlyMap<string, LoadedCanonicalPage>,
  ): LoadedCanonicalPage {
    const sourcePage = pagesBySourceId.get(sourcePageId);

    if (!sourcePage) {
      throw new Error(`Missing snapshot page for ${sourcePageId}`);
    }

    return sourcePage;
  }

  private skipUnsupportedNode(node: UnsupportedLoadedBlockNode, stats: ImportRunStats): void {
    stats.recordSkippedType(node.block.canonical.original_type);
    stats.recordSkippedBlocks(this.countNodes(node));
    this.progressReporter.report(
      `Skipping ${node.block.canonical.reason} block ${node.block.canonical.original_type} (${node.block.source.id})`,
    );
  }

  private asCanonicalBlockNode(node: LoadedBlockNode): CanonicalLoadedBlockNode {
    return node as CanonicalLoadedBlockNode;
  }

  private async handleTransformedBlockNode(
    node: CanonicalLoadedBlockNode,
    parentId: string,
    context: ImportContext,
  ): Promise<boolean> {
    if (node.block.canonical.block_type === "child_page") {
      this.progressReporter.report(
        `Preserving child page via page-shell transformation (${node.block.source.id})`,
      );
      context.stats.recordTransformedBlocks();
      return true;
    }

    if (node.block.canonical.block_type !== "child_database") {
      return false;
    }

    await this.importChildDatabaseNode(node, parentId, context);
    return true;
  }

  private async prepareReplayBlock(
    node: CanonicalLoadedBlockNode,
    assetResolver: PreparedImportAssetResolver,
  ): Promise<PreparedReplayBlock> {
    let uploadedFiles = 0;
    let request = NotionBlockRequestFactory.fromCanonicalBlock(
      node.block,
      this.canonicalChildBlocks(node),
    );

    if (!request) {
      const uploaded = await this.maybeCreateUploadedFileBlock(node, assetResolver);

      if (uploaded) {
        request = uploaded.request;
        uploadedFiles = 1;
      }
    }

    return {
      request,
      uploadedFiles,
      appendsChildrenInline: node.block.canonical.block_type === "table",
    };
  }

  private canonicalChildBlocks(
    node: CanonicalLoadedBlockNode,
  ): CanonicalLoadedBlockNode["block"][] {
    return node.children
      .map((childNode) => childNode.block)
      .filter(
        (childBlock): childBlock is CanonicalLoadedBlockNode["block"] => childBlock.object_type === "notion.block",
      );
  }

  private skipUnsupportedImportBlock(
    node: LoadedBlockNode,
    canonicalNode: CanonicalLoadedBlockNode,
    uploadedFiles: number,
    stats: ImportRunStats,
  ): void {
    stats.recordSkippedType(canonicalNode.block.canonical.block_type);
    stats.recordSkippedBlocks(this.countNodes(node));
    this.progressReporter.report(
      `Skipping unsupported import block ${canonicalNode.block.canonical.block_type} (${canonicalNode.block.source.id})`,
    );
    stats.recordUploadedFiles(uploadedFiles);
  }

  private async replayChildBlocks(
    childNodes: LoadedBlockNode[],
    destinationBlockId: string,
    context: ImportContext,
  ): Promise<void> {
    for (const childNode of childNodes) {
      try {
        await this.replayBlockNode(childNode, destinationBlockId, context);
      } catch (error) {
        context.stats.recordFailure("block_replay");
        this.progressReporter.report(
          `Import failure while replaying child block ${childNode.block.source.id}: ${this.errorMessage(error)}`,
        );
      }
    }
  }

  private async rewriteFilesPropertyForCreate(
    propertyValue: unknown,
    assetResolver: PreparedImportAssetResolver,
  ): Promise<number> {
    if (!propertyValue || typeof propertyValue !== "object") {
      return 0;
    }

    const property = propertyValue as {
      type?: unknown;
      value?: unknown;
    };

    if (property.type !== "files" || !Array.isArray(property.value)) {
      return 0;
    }

    const preparedFiles: Record<string, unknown>[] = [];
    let uploadedFiles = 0;

    for (const fileValue of property.value) {
      const prepared = await assetResolver.prepareFilePropertyValueForCreate(fileValue);

      if (prepared.file) {
        preparedFiles.push(prepared.file);
      }

      uploadedFiles += prepared.uploadedFiles;
    }

    property.value = preparedFiles;
    return uploadedFiles;
  }

  private timestamp(clock: (() => string) | undefined): string {
    return clock?.() ?? new Date().toISOString();
  }
}
