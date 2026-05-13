import { NotionId } from "../notion/NotionId.js";
import type { DestinationObjectRecord, SQLiteIndex } from "./SQLiteIndex.js";

interface DestinationMappingInput {
  destinationId: string;
  contentHash: string;
  status: string;
  createdAt: string;
}

type DestinationMappingIndex = Pick<
  SQLiteIndex,
  "getDestinationObject" | "listDestinationObjects" | "upsertDestinationObject"
>;

export class DestinationObjectMappings {
  public constructor(private readonly index: DestinationMappingIndex) {}

  public list(): DestinationObjectRecord[] {
    return this.index.listDestinationObjects();
  }

  public pageIdFor(sourcePageId: string): string | undefined {
    return this.destinationIdFor(NotionId.toSourcePageRef(sourcePageId));
  }

  public blockIdFor(sourceBlockId: string): string | undefined {
    return this.destinationIdFor(NotionId.toSourceBlockRef(sourceBlockId));
  }

  public databaseIdFor(sourceDatabaseId: string): string | undefined {
    return this.destinationIdFor(NotionId.toSourceDatabaseRef(sourceDatabaseId));
  }

  public recordPage(sourcePageId: string, mapping: DestinationMappingInput): void {
    this.upsert(NotionId.toSourcePageRef(sourcePageId), "notion.page", mapping);
  }

  public recordBlock(sourceBlockId: string, mapping: DestinationMappingInput): void {
    this.upsert(NotionId.toSourceBlockRef(sourceBlockId), "notion.block", mapping);
  }

  public recordDatabase(sourceDatabaseId: string, mapping: DestinationMappingInput): void {
    this.upsert(NotionId.toSourceDatabaseRef(sourceDatabaseId), "notion.database", mapping);
  }

  private destinationIdFor(sourceId: string): string | undefined {
    return this.index.getDestinationObject(sourceId)?.destination_id;
  }

  private upsert(
    sourceId: string,
    objectType: DestinationObjectRecord["object_type"],
    mapping: DestinationMappingInput,
  ): void {
    this.index.upsertDestinationObject({
      source_id: sourceId,
      destination_id: mapping.destinationId,
      object_type: objectType,
      content_hash: mapping.contentHash,
      status: mapping.status,
      created_at: mapping.createdAt,
    });
  }
}
