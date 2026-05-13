# Notion Snapshots

A local-first Notion snapshots CLI.

`notion-snapshots` exports a Notion root into a local content-addressable snapshot, then imports and verifies that snapshot against another Notion page. It is built for repeatable migrations, fidelity reporting, and keeping the snapshot on disk as the source of truth.

## What It Does

- `snapshot`: export a Notion page or database root into a local snapshot directory
- `inspect`: inspect a local snapshot directory or archive
- `import`: recreate a snapshot under a destination Notion page
- `verify`: compare imported content against the same snapshot after import
- `report`: render local reports for a snapshot

## Requirements

- [Bun](https://bun.sh/) `>= 1.3.14`
- A Notion integration token with access to the source and/or destination content you want to use

## Install

```bash
bun install
bun run build
```

Run the built CLI with:

```bash
./dist/notion-snapshots --help
```

For local development, you can also run:

```bash
bun run dev --help
```

## Environment Variables

The CLI loads `.env` automatically via `dotenv/config`.

You can always pass a token explicitly with `--token`, but if you do not, token lookup works like this:

- `snapshot`: `NOTION_SOURCE_TOKEN`, then `NOTION_TOKEN`
- `import`: `NOTION_DESTINATION_TOKEN`, then `NOTION_TOKEN`
- `verify`: `NOTION_DESTINATION_TOKEN`, then `NOTION_TOKEN`
- `inspect` and `report`: no token required

`--token` takes precedence over all environment variables.

### Recommended `.env`

Use separate tokens when source and destination are different integrations or workspaces:

```dotenv
NOTION_SOURCE_TOKEN=secret_xxx
NOTION_DESTINATION_TOKEN=secret_yyy
```

If you use the same token for both source and destination, you can set:

```dotenv
NOTION_TOKEN=secret_xxx
```

You can also mix them:

```dotenv
NOTION_SOURCE_TOKEN=secret_xxx
NOTION_DESTINATION_TOKEN=secret_yyy
NOTION_TOKEN=secret_fallback
```

## Usage

### Export a snapshot

```bash
./dist/notion-snapshots snapshot \
  --source-page "https://www.notion.so/your-page-or-page-id" \
  --out "./snapshots/my-export"
```

`--source-page` accepts a Notion page ID/URL, and can also resolve a database root when the supplied ID or URL points at a database.

Write a compressed archive at the end of export:

```bash
./dist/notion-snapshots snapshot \
  --source-page "https://www.notion.so/your-page-or-page-id" \
  --out "./snapshots/my-export" \
  --compress
```

This writes `./snapshots/my-export.tgz` alongside the snapshot directory. The directory remains the working snapshot used by later commands.

### Inspect a snapshot

```bash
./dist/notion-snapshots inspect --snapshot "./snapshots/my-export"
```

You can inspect either a snapshot directory or a `.tgz` archive.

### Import a snapshot

```bash
./dist/notion-snapshots import \
  --snapshot "./snapshots/my-export" \
  --target-page "https://www.notion.so/destination-page-or-id"
```

`import` writes destination mappings into the snapshot's SQLite index and writes `reports/import-report.md` into the snapshot. Use the snapshot directory, not only the archive, if you want a repeatable import -> verify workflow.

### Verify an import

```bash
./dist/notion-snapshots verify \
  --snapshot "./snapshots/my-export" \
  --target-page "https://www.notion.so/destination-page-or-id"
```

`verify` is designed to run against the same snapshot after `import`. It uses the saved source-to-destination mappings in `indexes/index.sqlite` to compare imported pages, blocks, databases, and transformed objects against the snapshot.

### Render reports

```bash
./dist/notion-snapshots report --snapshot "./snapshots/my-export"
```

`report` reads and concatenates any available local reports from `reports/export-report.md`, `reports/import-report.md`, and `reports/verify-report.md`.

## Typical Workflow

1. Run `snapshot` against a page or database root and keep the output directory.
2. Optionally add `--compress` to produce a sibling `.tgz` archive for transport or storage.
3. Run `import` against the snapshot directory and a destination page.
4. Run `verify` against that same snapshot directory and destination page.
5. Run `report` to review the saved export/import/verify reports.

## Important Notes

- Bun is the supported runtime. Node.js is no longer an officially supported way to run the CLI.
- `snapshot` can export either a page root or a database root, even though the option name is `--source-page`.
- `import` and `verify` currently require `--target-page`.
- Workspace-root imports are intentionally not supported.
- `--snapshot` accepts either a snapshot directory or a `.tgz` archive for `inspect`, `import`, `verify`, and `report`.
- Archive inputs are extracted into a temporary workspace for reading. That means `inspect` and `report` work well against `.tgz` files, but persisted state from `import` or `verify` is not written back into the original archive. For repeatable import -> verify runs, prefer the snapshot directory.
- Reports are written into the snapshot's `reports/` directory during export, import, and verify.
- Import preserves `child_page` and `child_database` content via transformations rather than replaying those blocks verbatim, and `verify` confirms the transformed results.
- Database imports currently recreate the primary data source in Notion. Additional data sources remain preserved canonically in the snapshot but are not recreated as separate destination data sources.
- Unsupported or partial block payloads are skipped during import and called out in the snapshot manifest and generated reports.
- Existing snapshots remain compatible across this Bun migration because the SQLite index schema is unchanged.

## Build Targets

Build the current-platform binary:

```bash
bun run build
```

Build named release binaries:

```bash
bun run build:darwin-arm64
bun run build:darwin-x64
bun run build:linux-arm64
bun run build:linux-x64
```

Cross-target release builds require a Bun version that supports `bun build --compile --target=...`. The scripts in this repo were validated with Bun `1.3.14`.

Build all release targets at once:

```bash
bun run build:release
```

Artifacts are written to `dist/` with predictable names such as `dist/notion-snapshots-darwin-arm64`.

## Complexity Checks

Cyclomatic complexity is measured with ESLint's built-in `complexity` rule at a threshold of `10`.

Generate a hotspot report for the current codebase:

```bash
bun run complexity
```

Run the underlying ESLint complexity check directly:

```bash
bun run complexity:check
```

## Linting

The repo also includes a TypeScript-focused ESLint setup for everyday linting.

Run lint checks:

```bash
bun run lint
```

Apply automatic fixes where available:

```bash
bun run lint:fix
```

`lint` focuses on general TypeScript and code-quality rules, while `complexity` remains a separate report/check for hotspot analysis.

## Help

Show top-level help:

```bash
./dist/notion-snapshots --help
```

Show help for a specific command:

```bash
./dist/notion-snapshots import --help
./dist/notion-snapshots verify --help
```
