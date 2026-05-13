import type { ObjectStore } from "../cas/ObjectStore.js";
import { ContentHash } from "../domain/ContentHash.js";
import {
  primaryCanonicalDatabaseDataSource,
  type LoadedCanonicalDatabase,
  type LoadedCanonicalDatabaseRow,
  type LoadedCanonicalDatabaseSchema,
} from "../domain/CanonicalNotionDatabase.js";
import { NotionDatabaseRequestFactory } from "../import/NotionDatabaseRequestFactory.js";
import type { DestinationObjectMappings } from "../mappings/DestinationObjectMappings.js";
import type { NotionBlockRetriever } from "../notion/NotionBlockRetriever.js";
import { NotionId } from "../notion/NotionId.js";
import type { NotionPageReader } from "../notion/NotionPageReader.js";
import { NotionPagePropertyCodec } from "../notion/NotionPagePropertyCodec.js";
import {
  VerifyReportWriter,
  type VerifyReportFailureDetail,
} from "../reports/VerifyReportWriter.js";
import { SnapshotReportPersistence } from "../reports/SnapshotReportPersistence.js";
import {
  SnapshotLoader,
  type LoadedBlockNode,
  type LoadedCanonicalBlock,
  type LoadedCanonicalPage,
  type LoadedChildren,
} from "../snapshot/SnapshotLoader.js";
import { withSnapshotOperationSession } from "../snapshot/SnapshotOperationSession.js";
import { SnapshotVerifyBlockNormalizer } from "./SnapshotVerifyBlockNormalizer.js";
import { SnapshotVerifyPropertyNormalizer } from "./SnapshotVerifyPropertyNormalizer.js";
import { SnapshotVerifyValueNormalizer } from "./SnapshotVerifyValueNormalizer.js";

interface NotionDatabaseLookup {
  fetchDatabase(databaseId: string): Promise<Record<string, unknown>>;
  fetchDataSource(dataSourceId: string): Promise<Record<string, unknown>>;
}

export interface SnapshotVerifierResult {
  verifiedPages: number;
  verifiedBlocks: number;
  verifiedDatabases: number;
  transformedObjects: number;
  failures: number;
}

class VerificationMismatchError extends Error {
  public constructor(
    message: string,
    public readonly expected?: unknown,
    public readonly actual?: unknown,
  ) {
    super(message);
  }
}

export class SnapshotVerifier {
  private readonly snapshotLoader: SnapshotLoader;

  public constructor(
    private readonly pageReader: NotionPageReader,
    private readonly blockRetriever: NotionBlockRetriever,
    private readonly databaseLookup: NotionDatabaseLookup,
    options?: {
      snapshotLoader?: SnapshotLoader;
    },
  ) {
    this.snapshotLoader = options?.snapshotLoader ?? new SnapshotLoader();
  }

  public async run(options: {
    snapshotPath: string;
    targetPageId: string;
  }): Promise<SnapshotVerifierResult> {
    return withSnapshotOperationSession(
      {
        snapshotPath: options.snapshotPath,
        snapshotLoader: this.snapshotLoader,
      },
      async ({ snapshot, objectStore, destinationMappings }) => {
        let verifiedPages = 0;
        let verifiedBlocks = 0;
        let verifiedDatabases = 0;
        let transformedObjects = 0;
        const failureDetails: VerifyReportFailureDetail[] = [];

        await this.pageReader.fetchPage(NotionId.parsePageId(options.targetPageId));

        for (const record of destinationMappings.list()) {
          try {
            if (record.object_type === "notion.page") {
              const page = await objectStore.get<LoadedCanonicalPage>(ContentHash.parse(record.content_hash));
              const destinationPage = await this.pageReader.fetchPage(record.destination_id);
              this.verifyPage(page, destinationPage, record.source_id);
              verifiedPages += 1;
              continue;
            }

            if (record.object_type === "notion.block") {
              const block = await objectStore.get<LoadedCanonicalBlock>(ContentHash.parse(record.content_hash));
              const destinationBlock = await this.blockRetriever.fetchBlock(record.destination_id);
              await this.verifyBlockPayload(block, destinationBlock, objectStore, record.source_id);
              verifiedBlocks += 1;
              continue;
            }

            if (record.object_type === "notion.database") {
              const database = await objectStore.get<LoadedCanonicalDatabase>(
                ContentHash.parse(record.content_hash),
              );
              const destinationDatabase = await this.databaseLookup.fetchDatabase(record.destination_id);
              const primaryDataSource = primaryCanonicalDatabaseDataSource(database);
              const schema = await objectStore.get<LoadedCanonicalDatabaseSchema>(
                ContentHash.parse(primaryDataSource.schema_ref),
              );
              const destinationDataSource = await this.databaseLookup.fetchDataSource(
                this.extractPrimaryDatabaseDataSourceId(destinationDatabase, record.source_id),
              );
              this.verifyDatabase(
                database,
                schema,
                destinationDatabase,
                destinationDataSource,
                record.source_id,
              );
              verifiedDatabases += 1;
            }
          } catch (error) {
            failureDetails.push(this.toFailureDetail(record, error));
          }
        }

        for (const pageBlocks of snapshot.pageBlocks.values()) {
          const transformed = await this.verifyTransformedObjects(
            pageBlocks,
            objectStore,
            destinationMappings,
          );
          transformedObjects += transformed.transformedObjects;
          failureDetails.push(...transformed.failureDetails);
        }

        await this.writeVerifyReport(snapshot.snapshotRoot, {
          targetPageId: NotionId.parsePageId(options.targetPageId),
          verifiedPages,
          verifiedBlocks,
          verifiedDatabases,
          transformedObjects,
          failures: failureDetails.length,
          failureDetails,
        });

        return {
          verifiedPages,
          verifiedBlocks,
          verifiedDatabases,
          transformedObjects,
          failures: failureDetails.length,
        };
      },
    );
  }

  private async verifyTransformedObjects(
    nodes: LoadedBlockNode[],
    objectStore: ObjectStore,
    destinationMappings: DestinationObjectMappings,
  ): Promise<{ transformedObjects: number; failureDetails: VerifyReportFailureDetail[] }> {
    let transformedObjects = 0;
    const failureDetails: VerifyReportFailureDetail[] = [];

    for (const node of nodes) {
      if (node.block.object_type !== "notion.block") {
        continue;
      }

      const canonicalNode = node as {
        block: LoadedCanonicalBlock;
        children: LoadedBlockNode[];
      };

      if (canonicalNode.block.canonical.block_type === "child_page") {
        try {
          await this.verifyChildPageTransformation(canonicalNode, objectStore, destinationMappings);
          transformedObjects += 1;
        } catch (error) {
          failureDetails.push(
            this.toFailureDetail(
              {
                object_type: "transformed.child_page",
                source_id: NotionId.toSourceBlockRef(canonicalNode.block.source.id),
              },
              error,
            ),
          );
        }
      } else if (canonicalNode.block.canonical.block_type === "child_database") {
        try {
          await this.verifyChildDatabaseTransformation(
            canonicalNode,
            objectStore,
            destinationMappings,
          );
          transformedObjects += 1;
        } catch (error) {
          failureDetails.push(
            this.toFailureDetail(
              {
                object_type: "transformed.child_database",
                source_id: NotionId.toSourceBlockRef(canonicalNode.block.source.id),
              },
              error,
            ),
          );
        }
      }

      const nested = await this.verifyTransformedObjects(
        canonicalNode.children,
        objectStore,
        destinationMappings,
      );
      transformedObjects += nested.transformedObjects;
      failureDetails.push(...nested.failureDetails);
    }

    return { transformedObjects, failureDetails };
  }

  private verifyPage(
    page: LoadedCanonicalPage,
    destinationPage: Record<string, unknown>,
    sourceId: string,
  ): void {
    const expectedProperties = NotionPagePropertyCodec.comparableExpectedProperties(
      page.canonical.properties,
    );
    const actualProperties = NotionPagePropertyCodec.comparableActualProperties(
      destinationPage,
      page.canonical.properties,
    );

    this.assertDeepEqual(expectedProperties, actualProperties, `Page properties mismatch for ${sourceId}`);

    const expectedIcon = NotionPagePropertyCodec.comparableIcon(page.canonical.icon);
    if (expectedIcon) {
      const actualIcon = NotionPagePropertyCodec.comparableIcon(destinationPage.icon);
      this.assertDeepEqual(expectedIcon, actualIcon, `Page icon mismatch for ${sourceId}`);
    }

    const expectedCover = NotionPagePropertyCodec.comparableCover(page.canonical.cover);
    if (expectedCover) {
      const actualCover = NotionPagePropertyCodec.comparableCover(destinationPage.cover);
      this.assertDeepEqual(expectedCover, actualCover, `Page cover mismatch for ${sourceId}`);
    }
  }

  private verifyDatabase(
    database: LoadedCanonicalDatabase,
    schema: LoadedCanonicalDatabaseSchema,
    destinationDatabase: Record<string, unknown>,
    destinationDataSource: Record<string, unknown>,
    sourceId: string,
  ): void {
    const expectedTitle = SnapshotVerifyValueNormalizer.richTextPlainText(database.canonical.title);
    const actualTitle = SnapshotVerifyValueNormalizer.richTextPlainText(destinationDatabase.title);
    this.assertDeepEqual(expectedTitle, actualTitle, `Database title mismatch for ${sourceId}`);

    const expectedDescription = SnapshotVerifyValueNormalizer.richTextArray(database.canonical.description);
    const actualDescription = SnapshotVerifyValueNormalizer.richTextArray(destinationDatabase.description);
    this.assertDeepEqual(expectedDescription, actualDescription, `Database description mismatch for ${sourceId}`);

    const expectedSchema = NotionDatabaseRequestFactory.propertiesForSchema(schema);
    const actualSchema = SnapshotVerifyPropertyNormalizer.actualSchemaProperties(
      destinationDataSource.properties,
      schema,
    );
    this.assertDeepEqual(expectedSchema, actualSchema, `Database schema mismatch for ${sourceId}`);
  }

  private async verifyBlockPayload(
    block: LoadedCanonicalBlock,
    destinationBlock: Record<string, unknown>,
    objectStore: ObjectStore,
    sourceId: string,
  ): Promise<void> {
    const destinationType =
      destinationBlock && typeof destinationBlock === "object"
        ? destinationBlock.type
        : undefined;
    this.assertDeepEqual(
      block.canonical.block_type,
      destinationType,
      `Block type mismatch for ${sourceId}`,
    );

    const expectedPayload = await SnapshotVerifyBlockNormalizer.expectedPayload(block, objectStore);

    if (expectedPayload === null) {
      return;
    }

    const actualPayload = SnapshotVerifyBlockNormalizer.actualPayload(block.canonical.block_type, destinationBlock);
    this.assertDeepEqual(
      expectedPayload,
      actualPayload,
      `Block payload mismatch for ${sourceId}`,
    );
  }

  private async verifyChildPageTransformation(
    node: {
      block: LoadedCanonicalBlock;
      children: LoadedBlockNode[];
    },
    objectStore: ObjectStore,
    destinationMappings: DestinationObjectMappings,
  ): Promise<void> {
    const pageRef = node.block.canonical.payload.page_ref;

    if (typeof pageRef !== "string") {
      throw new VerificationMismatchError(
        `Child page transform is missing a canonical page reference for ${node.block.source.id}`,
      );
    }

    const page = await objectStore.get<LoadedCanonicalPage>(ContentHash.parse(pageRef));
    const destinationPageId = destinationMappings.pageIdFor(page.source.id);

    if (!destinationPageId) {
      throw new VerificationMismatchError(
        `Missing destination page mapping for transformed child page ${page.source.id}`,
      );
    }

    const destinationPage = await this.pageReader.fetchPage(destinationPageId);
    this.verifyPage(page, destinationPage, NotionId.toSourcePageRef(page.source.id));
  }

  private async verifyChildDatabaseTransformation(
    node: {
      block: LoadedCanonicalBlock;
      children: LoadedBlockNode[];
    },
    objectStore: ObjectStore,
    destinationMappings: DestinationObjectMappings,
  ): Promise<void> {
    const databaseRef = node.block.canonical.payload.database_ref;

    if (typeof databaseRef !== "string") {
      throw new VerificationMismatchError(
        `Child database transform is missing a canonical database reference for ${node.block.source.id}`,
      );
    }

    const database = await objectStore.get<LoadedCanonicalDatabase>(ContentHash.parse(databaseRef));
    const destinationDatabaseId = destinationMappings.databaseIdFor(database.source.id);

    if (!destinationDatabaseId) {
      throw new VerificationMismatchError(
        `Missing destination database mapping for transformed child database ${database.source.id}`,
      );
    }

    const destinationDatabase = await this.databaseLookup.fetchDatabase(destinationDatabaseId);
    const primaryDataSource = primaryCanonicalDatabaseDataSource(database);
    const schema = await objectStore.get<LoadedCanonicalDatabaseSchema>(
      ContentHash.parse(primaryDataSource.schema_ref),
    );
    const destinationDataSource = await this.databaseLookup.fetchDataSource(
      this.extractPrimaryDatabaseDataSourceId(
        destinationDatabase,
        NotionId.toSourceDatabaseRef(database.source.id),
      ),
    );
    this.verifyDatabase(
      database,
      schema,
      destinationDatabase,
      destinationDataSource,
      NotionId.toSourceDatabaseRef(database.source.id),
    );

    const rows = await objectStore.get<LoadedChildren>(ContentHash.parse(primaryDataSource.rows_ref));

    for (const rowEntry of rows.children) {
      const row = await objectStore.get<LoadedCanonicalDatabaseRow>(ContentHash.parse(rowEntry.ref));
      const destinationRowPageId = destinationMappings.pageIdFor(row.source.id);

      if (!destinationRowPageId) {
        throw new VerificationMismatchError(
          `Missing destination row mapping for transformed child database row ${row.source.id}`,
        );
      }

      const destinationRowPage = await this.pageReader.fetchPage(destinationRowPageId);
      const expectedProperties = SnapshotVerifyPropertyNormalizer.expectedRowProperties(
        row.canonical.properties,
      );
      const actualProperties = SnapshotVerifyPropertyNormalizer.actualRowProperties(
        destinationRowPage,
        row.canonical.properties,
      );

      this.assertDeepEqual(
        expectedProperties,
        actualProperties,
        `Database row properties mismatch for ${NotionId.toSourcePageRef(row.source.id)}`,
      );
    }
  }

  private async writeVerifyReport(
    snapshotRoot: string,
    summary: {
      targetPageId: string;
      verifiedPages: number;
      verifiedBlocks: number;
      verifiedDatabases: number;
      transformedObjects: number;
      failures: number;
      failureDetails: VerifyReportFailureDetail[];
    },
  ): Promise<void> {
    const report = VerifyReportWriter.render(summary);
    await SnapshotReportPersistence.write(snapshotRoot, "verify-report.md", report);
  }

  private extractPrimaryDatabaseDataSourceId(database: Record<string, unknown>, sourceId: string): string {
    const dataSources = database.data_sources;

    if (!Array.isArray(dataSources)) {
      throw new VerificationMismatchError(`Database is missing data source metadata for ${sourceId}`);
    }

    const firstDataSource: unknown = dataSources[0];

    if (!firstDataSource || typeof firstDataSource !== "object") {
      throw new VerificationMismatchError(`Database is missing an initial data source id for ${sourceId}`);
    }

    const firstDataSourceRecord = firstDataSource as Record<string, unknown>;

    if (typeof firstDataSourceRecord.id !== "string") {
      throw new VerificationMismatchError(`Database is missing an initial data source id for ${sourceId}`);
    }

    return firstDataSourceRecord.id;
  }

  private assertDeepEqual(expected: unknown, actual: unknown, message: string): void {
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      throw new VerificationMismatchError(message, expected, actual);
    }
  }

  private toFailureDetail(
    record: {
      object_type: string;
      source_id: string;
      destination_id?: string;
    },
    error: unknown,
  ): VerifyReportFailureDetail {
    return {
      objectType: record.object_type,
      sourceId: record.source_id,
      message: error instanceof Error ? error.message : String(error),
      ...(record.destination_id ? { destinationId: record.destination_id } : {}),
      ...(error instanceof VerificationMismatchError && error.expected !== undefined
        ? { expected: error.expected }
        : {}),
      ...(error instanceof VerificationMismatchError && error.actual !== undefined
        ? { actual: error.actual }
        : {}),
    };
  }
}
