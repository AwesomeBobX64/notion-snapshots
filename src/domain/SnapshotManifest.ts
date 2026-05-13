import { z } from "zod";
import { CanonicalJson } from "../cas/CanonicalJson.js";
import { ContentHash } from "./ContentHash.js";

export const SnapshotStatusSchema = z.enum([
  "running",
  "complete",
  "complete_with_warnings",
  "partial",
  "failed",
]);

export type SnapshotStatus = z.infer<typeof SnapshotStatusSchema>;

const SnapshotRootSchema = z.object({
  source_id: z.string().min(1),
  content_hash: z.string().nullable(),
});

const SnapshotCountsSchema = z.object({
  pages: z.number().int().nonnegative(),
  blocks: z.number().int().nonnegative(),
  databases: z.number().int().nonnegative(),
  rows: z.number().int().nonnegative(),
  files: z.number().int().nonnegative(),
  comments: z.number().int().nonnegative(),
  unsupported: z.number().int().nonnegative(),
  failures: z.number().int().nonnegative(),
});

const SnapshotArtifactsSchema = z.object({
  has_index_sqlite: z.boolean(),
  has_reports: z.boolean(),
  compressed: z.boolean(),
});

export const SnapshotManifestSchema = z.object({
  tool: z.enum(["notion-snapshots", "notion-clone"]),
  schema_version: z.literal(1),
  created_at: z.string().datetime(),
  snapshot_id: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  root: SnapshotRootSchema,
  counts: SnapshotCountsSchema,
  artifacts: SnapshotArtifactsSchema,
  status: SnapshotStatusSchema,
});

export type SnapshotManifestData = z.infer<typeof SnapshotManifestSchema>;

type SnapshotCounts = SnapshotManifestData["counts"];
type SnapshotArtifacts = SnapshotManifestData["artifacts"];
type SnapshotRoot = SnapshotManifestData["root"];

export class SnapshotManifest {
  private static readonly TERMINAL_STATUSES = new Set<SnapshotStatus>([
    "complete",
    "complete_with_warnings",
    "partial",
    "failed",
  ]);

  private constructor(private readonly data: SnapshotManifestData) {}

  public static create(input: {
    createdAt?: string;
    sourceId: string;
    contentHash?: ContentHash | null;
    counts?: Partial<SnapshotCounts>;
    artifacts?: Partial<SnapshotArtifacts>;
    status?: SnapshotStatus;
  }): SnapshotManifest {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const root: SnapshotRoot = {
      source_id: input.sourceId,
      content_hash: input.contentHash?.toString() ?? null,
    };
    const counts: SnapshotCounts = {
      pages: 0,
      blocks: 0,
      databases: 0,
      rows: 0,
      files: 0,
      comments: 0,
      unsupported: 0,
      failures: 0,
      ...input.counts,
    };
    const artifacts: SnapshotArtifacts = {
      has_index_sqlite: false,
      has_reports: false,
      compressed: false,
      ...input.artifacts,
    };

    return SnapshotManifest.fromJSON({
      tool: "notion-snapshots",
      schema_version: 1,
      created_at: createdAt,
      snapshot_id: SnapshotManifest.computeSnapshotId(root, counts),
      root,
      counts,
      artifacts,
      status: input.status ?? "running",
    });
  }

  public static fromJSON(value: unknown): SnapshotManifest {
    const parsed = SnapshotManifestSchema.parse(value);
    return new SnapshotManifest(parsed);
  }

  public static computeSnapshotId(root: SnapshotRoot, counts: SnapshotCounts): string {
    return ContentHash.fromString(CanonicalJson.stringify({ root, counts })).toString();
  }

  public markCompressed(): SnapshotManifest {
    return this.withArtifacts({ compressed: true });
  }

  public markIndexCreated(): SnapshotManifest {
    return this.withArtifacts({ has_index_sqlite: true });
  }

  public markReportsCreated(): SnapshotManifest {
    return this.withArtifacts({ has_reports: true });
  }

  public withContentHash(contentHash: ContentHash): SnapshotManifest {
    return this.rebuild({
      root: {
        ...this.data.root,
        content_hash: contentHash.toString(),
      },
    });
  }

  public withCounts(counts: Partial<SnapshotCounts>): SnapshotManifest {
    return this.rebuild({
      counts: {
        ...this.data.counts,
        ...counts,
      },
    });
  }

  public withStatus(status: SnapshotStatus): SnapshotManifest {
    if (
      SnapshotManifest.TERMINAL_STATUSES.has(this.data.status) &&
      status === "running"
    ) {
      throw new Error("Cannot transition a finalized snapshot back to running");
    }

    return this.rebuild({ status });
  }

  public toJSON(): SnapshotManifestData {
    return structuredClone(this.data);
  }

  public get snapshotId(): string {
    return this.data.snapshot_id;
  }

  public get status(): SnapshotStatus {
    return this.data.status;
  }

  public get root(): SnapshotRoot {
    return structuredClone(this.data.root);
  }

  private withArtifacts(artifacts: Partial<SnapshotArtifacts>): SnapshotManifest {
    return this.rebuild({
      artifacts: {
        ...this.data.artifacts,
        ...artifacts,
      },
    });
  }

  private rebuild(overrides: Partial<SnapshotManifestData>): SnapshotManifest {
    const nextData: SnapshotManifestData = {
      ...this.data,
      ...overrides,
      root: overrides.root ?? this.data.root,
      counts: overrides.counts ?? this.data.counts,
      artifacts: overrides.artifacts ?? this.data.artifacts,
    };

    nextData.snapshot_id = SnapshotManifest.computeSnapshotId(nextData.root, nextData.counts);

    return SnapshotManifest.fromJSON(nextData);
  }
}
