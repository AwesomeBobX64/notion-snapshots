import { Database } from "bun:sqlite";

type SQLiteBindable = string | number | bigint | boolean | Uint8Array | null;

export interface SourceObjectRecord {
  source_id: string;
  object_type: string;
  content_hash: string;
  raw_hash: string | null;
  status: string;
  created_at: string;
}

export interface DestinationObjectRecord {
  source_id: string;
  destination_id: string;
  object_type: string;
  content_hash: string;
  status: string;
  created_at: string;
}

export interface ObjectStoreIndexRecord {
  content_hash: string;
  object_type: string;
  path: string;
  size_bytes: number | null;
  created_at: string;
}

export interface BlobStoreIndexRecord {
  blob_hash: string;
  path: string;
  size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
}

export interface TaskRunRecord {
  run_id: string;
  task_id: string;
  task_kind: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  retry_count: number;
  error: string | null;
}

export class SQLiteIndex {
  private readonly database: Database;
  private static readonly SCHEMA_STATEMENTS = [
    `CREATE TABLE IF NOT EXISTS source_objects (
      source_id TEXT PRIMARY KEY,
      object_type TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      raw_hash TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS destination_objects (
      source_id TEXT PRIMARY KEY,
      destination_id TEXT NOT NULL,
      object_type TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS object_store (
      content_hash TEXT PRIMARY KEY,
      object_type TEXT NOT NULL,
      path TEXT NOT NULL,
      size_bytes INTEGER,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS blob_store (
      blob_hash TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      size_bytes INTEGER,
      mime_type TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS task_runs (
      run_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      task_kind TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      PRIMARY KEY (run_id, task_id)
    )`,
  ];

  public constructor(private readonly databasePath: string) {
    this.database = new Database(this.databasePath, {
      create: true,
      readwrite: true,
      strict: true,
    });
    this.database.run("PRAGMA journal_mode = WAL;");
  }

  public initialize(): void {
    for (const statement of SQLiteIndex.SCHEMA_STATEMENTS) {
      this.database.run(statement);
    }
  }

  public upsertSourceObject(record: SourceObjectRecord): void {
    this.database
      .query(`
        INSERT INTO source_objects (source_id, object_type, content_hash, raw_hash, status, created_at)
        VALUES ($source_id, $object_type, $content_hash, $raw_hash, $status, $created_at)
        ON CONFLICT(source_id) DO UPDATE SET
          object_type = excluded.object_type,
          content_hash = excluded.content_hash,
          raw_hash = excluded.raw_hash,
          status = excluded.status,
          created_at = excluded.created_at
      `)
      .run(SQLiteIndex.toBindings(record));
  }

  public getSourceObject(sourceId: string): SourceObjectRecord | undefined {
    return (this.database
      .query("SELECT * FROM source_objects WHERE source_id = ?")
      .get(sourceId) as SourceObjectRecord | null | undefined) ?? undefined;
  }

  public upsertDestinationObject(record: DestinationObjectRecord): void {
    this.database
      .query(`
        INSERT INTO destination_objects (source_id, destination_id, object_type, content_hash, status, created_at)
        VALUES ($source_id, $destination_id, $object_type, $content_hash, $status, $created_at)
        ON CONFLICT(source_id) DO UPDATE SET
          destination_id = excluded.destination_id,
          object_type = excluded.object_type,
          content_hash = excluded.content_hash,
          status = excluded.status,
          created_at = excluded.created_at
      `)
      .run(SQLiteIndex.toBindings(record));
  }

  public getDestinationObject(sourceId: string): DestinationObjectRecord | undefined {
    return (this.database
      .query("SELECT * FROM destination_objects WHERE source_id = ?")
      .get(sourceId) as DestinationObjectRecord | null | undefined) ?? undefined;
  }

  public listDestinationObjects(): DestinationObjectRecord[] {
    return this.database
      .query("SELECT * FROM destination_objects ORDER BY source_id")
      .all() as DestinationObjectRecord[];
  }

  public upsertObjectStore(record: ObjectStoreIndexRecord): void {
    this.database
      .query(`
        INSERT INTO object_store (content_hash, object_type, path, size_bytes, created_at)
        VALUES ($content_hash, $object_type, $path, $size_bytes, $created_at)
        ON CONFLICT(content_hash) DO UPDATE SET
          object_type = excluded.object_type,
          path = excluded.path,
          size_bytes = excluded.size_bytes,
          created_at = excluded.created_at
      `)
      .run(SQLiteIndex.toBindings(record));
  }

  public getObjectStore(contentHash: string): ObjectStoreIndexRecord | undefined {
    return (this.database
      .query("SELECT * FROM object_store WHERE content_hash = ?")
      .get(contentHash) as ObjectStoreIndexRecord | null | undefined) ?? undefined;
  }

  public upsertBlobStore(record: BlobStoreIndexRecord): void {
    this.database
      .query(`
        INSERT INTO blob_store (blob_hash, path, size_bytes, mime_type, created_at)
        VALUES ($blob_hash, $path, $size_bytes, $mime_type, $created_at)
        ON CONFLICT(blob_hash) DO UPDATE SET
          path = excluded.path,
          size_bytes = excluded.size_bytes,
          mime_type = excluded.mime_type,
          created_at = excluded.created_at
      `)
      .run(SQLiteIndex.toBindings(record));
  }

  public getBlobStore(blobHash: string): BlobStoreIndexRecord | undefined {
    return (this.database
      .query("SELECT * FROM blob_store WHERE blob_hash = ?")
      .get(blobHash) as BlobStoreIndexRecord | null | undefined) ?? undefined;
  }

  public upsertTaskRun(record: TaskRunRecord): void {
    this.database
      .query(`
        INSERT INTO task_runs (
          run_id,
          task_id,
          task_kind,
          status,
          started_at,
          finished_at,
          retry_count,
          error
        )
        VALUES (
          $run_id,
          $task_id,
          $task_kind,
          $status,
          $started_at,
          $finished_at,
          $retry_count,
          $error
        )
        ON CONFLICT(run_id, task_id) DO UPDATE SET
          task_kind = excluded.task_kind,
          status = excluded.status,
          started_at = excluded.started_at,
          finished_at = excluded.finished_at,
          retry_count = excluded.retry_count,
          error = excluded.error
      `)
      .run(SQLiteIndex.toBindings(record));
  }

  public close(): void {
    this.database.close(false);
  }

  private static toBindings<T extends object>(record: T): Record<string, SQLiteBindable> {
    const bindings: Record<string, SQLiteBindable> = {};
    for (const [key, value] of Object.entries(record as Record<string, SQLiteBindable>)) {
      bindings[`$${key}`] = value;
    }
    return bindings;
  }
}
