import { Command } from "commander";
import { StdoutProgressReporter } from "../app/ProgressReporter.js";
import { ImportWorkflow } from "../import/ImportWorkflow.js";
import { SnapshotVerifier } from "../verify/SnapshotVerifier.js";
import { NotionDatabaseFetcher } from "../notion/NotionDatabaseFetcher.js";
import { NotionDestinationBlockWriter } from "../notion/NotionDestinationBlockWriter.js";
import { NotionDestinationDatabaseWriter } from "../notion/NotionDestinationDatabaseWriter.js";
import { NotionDestinationFileUploader } from "../notion/NotionDestinationFileUploader.js";
import { HttpFileDownloader } from "../notion/HttpFileDownloader.js";
import { NotionDestinationPageWriter } from "../notion/NotionDestinationPageWriter.js";
import { NotionBlockFetcher } from "../notion/NotionBlockFetcher.js";
import { NotionClientFactory } from "../notion/NotionClientFactory.js";
import { NotionPageFetcher } from "../notion/NotionPageFetcher.js";
import { SnapshotWorkflow } from "../export/SnapshotWorkflow.js";
import { SnapshotInspector } from "../snapshot/SnapshotInspector.js";
import { SnapshotReportReader } from "../snapshot/SnapshotReportReader.js";
import { ConfigurationError, NotYetImplementedError } from "../util/Errors.js";
import { Env } from "../util/Env.js";

const ENVIRONMENT_HELP = `Environment:
  Tokens can be provided with --token or through environment variables.
  The CLI loads .env automatically via dotenv.

  Resolution order:
    snapshot -> --token, NOTION_SOURCE_TOKEN, NOTION_TOKEN
    import  -> --token, NOTION_DESTINATION_TOKEN, NOTION_TOKEN
    verify  -> --token, NOTION_DESTINATION_TOKEN, NOTION_TOKEN

  Notes:
    - inspect and report do not require a Notion token
    - import and verify require --target-page; workspace-root imports are not supported`;

const RUNTIME_HELP = `Runtime:
  Bun is the supported runtime.
  Local dev: bun run dev --help
  Build binary: bun run build
  Built CLI: ./dist/notion-snapshots --help`;

export class CliApplication {
  public async run(argv: string[]): Promise<void> {
    const program = new Command();

    program
      .name("notion-snapshots")
      .description("Notion Snapshots: a local-first Notion snapshot tool.")
      .version("1.0.0")
      .addHelpText("after", `\n${ENVIRONMENT_HELP}\n\n${RUNTIME_HELP}\n`);

    program
      .command("snapshot")
      .description("Export a root Notion page into a local snapshot.")
      .requiredOption("--source-page <notion_page_id_or_url>", "Source Notion page id or URL")
      .requiredOption("--out <path>", "Snapshot output directory path")
      .option("--token <token>", "Source Notion token; defaults to NOTION_SOURCE_TOKEN or NOTION_TOKEN")
      .option("--compress", "Compress the finished snapshot into a .tgz archive")
      .addHelpText(
        "after",
        "\nToken resolution: --token -> NOTION_SOURCE_TOKEN -> NOTION_TOKEN\n",
      )
      .action(
        async (options: { sourcePage: string; out: string; token?: string; compress?: boolean }) => {
          const token = Env.resolveNotionToken({
            explicitToken: options.token,
            role: "source",
          });

          if (!token) {
            throw new ConfigurationError(
              "Missing Notion source token. Use --token, NOTION_SOURCE_TOKEN, or NOTION_TOKEN.",
            );
          }

          const client = NotionClientFactory.create(token);
          const workflow = new SnapshotWorkflow(
            new NotionPageFetcher(client),
            new NotionBlockFetcher(client),
            new HttpFileDownloader(),
            new NotionDatabaseFetcher(client),
            undefined,
            new StdoutProgressReporter(),
          );
          const result = await workflow.run({
            sourcePage: options.sourcePage,
            token,
            snapshotRoot: options.out,
            compress: options.compress ?? false,
          });

          process.stdout.write(`Initialized snapshot at ${result.snapshotRoot}\n`);

          if (result.archivePath) {
            process.stdout.write(`Compressed snapshot archive: ${result.archivePath}\n`);
          }
        },
      );

    program
      .command("inspect")
      .description("Inspect a local snapshot directory or archive.")
      .requiredOption("--snapshot <path>", "Snapshot directory or .tgz archive")
      .action(async (options: { snapshot: string }) => {
        const output = await new SnapshotInspector().inspect(options.snapshot);
        process.stdout.write(`${output}\n`);
      });

    program
      .command("import")
      .description("Import a snapshot into a destination page.")
      .requiredOption("--snapshot <path>", "Snapshot directory or .tgz archive")
      .requiredOption("--target-page <notion_page_id_or_url>", "Target Notion page id or URL")
      .option(
        "--token <token>",
        "Destination Notion token; defaults to NOTION_DESTINATION_TOKEN or NOTION_TOKEN",
      )
      .addHelpText(
        "after",
        "\nToken resolution: --token -> NOTION_DESTINATION_TOKEN -> NOTION_TOKEN\n",
      )
      .action(
        async (options: { snapshot: string; targetPage: string; token?: string }) => {
          const token = Env.resolveNotionToken({
            explicitToken: options.token,
            role: "destination",
          });

          if (!token) {
            throw new ConfigurationError(
              "Missing Notion destination token. Use --token, NOTION_DESTINATION_TOKEN, or NOTION_TOKEN.",
            );
          }

          const client = NotionClientFactory.create(token);
          const workflow = new ImportWorkflow(
            new NotionDestinationPageWriter(client),
            new NotionDestinationBlockWriter(client),
            {
              databaseWriter: new NotionDestinationDatabaseWriter(client),
              fileUploader: new NotionDestinationFileUploader(client),
              progressReporter: new StdoutProgressReporter(),
            },
          );
          const result = await workflow.run({
            snapshotPath: options.snapshot,
            targetPageId: options.targetPage,
          });

          process.stdout.write(
            `Created ${result.createdPages} destination page shells and replayed ${result.createdBlocks} blocks`,
          );
          process.stdout.write(
            ` (${result.transformedBlocks} transformed, ${result.uploadedFiles} files, ${result.skippedBlocks} skipped)\n`,
          );
        },
      );

    program
      .command("verify")
      .description("Verify an imported snapshot against a destination page.")
      .requiredOption("--snapshot <path>", "Snapshot directory or .tgz archive")
      .requiredOption("--target-page <notion_page_id_or_url>", "Target Notion page id or URL")
      .option(
        "--token <token>",
        "Destination Notion token; defaults to NOTION_DESTINATION_TOKEN or NOTION_TOKEN",
      )
      .addHelpText(
        "after",
        "\nToken resolution: --token -> NOTION_DESTINATION_TOKEN -> NOTION_TOKEN\n",
      )
      .action(
        async (options: { snapshot: string; targetPage: string; token?: string }) => {
          const token = Env.resolveNotionToken({
            explicitToken: options.token,
            role: "destination",
          });

          if (!token) {
            throw new ConfigurationError(
              "Missing Notion destination token. Use --token, NOTION_DESTINATION_TOKEN, or NOTION_TOKEN.",
            );
          }

          const client = NotionClientFactory.create(token);
          const verifier = new SnapshotVerifier(
            new NotionPageFetcher(client),
            new NotionBlockFetcher(client),
            new NotionDatabaseFetcher(client),
          );
          const result = await verifier.run({
            snapshotPath: options.snapshot,
            targetPageId: options.targetPage,
          });

          process.stdout.write(
            `Verified ${result.verifiedPages} pages, ${result.verifiedBlocks} blocks, ${result.verifiedDatabases} databases`,
          );
          process.stdout.write(
            ` (${result.transformedObjects} transformed, ${result.failures} failures)\n`,
          );
        },
      );

    program
      .command("report")
      .description("Render local reports for a snapshot.")
      .requiredOption("--snapshot <path>", "Snapshot directory or .tgz archive")
      .action(async (options: { snapshot: string }) => {
        const report = await new SnapshotReportReader().read(options.snapshot);
        process.stdout.write(report);
      });

    try {
      await program.parseAsync(argv);
    } catch (error) {
      if (error instanceof NotYetImplementedError || error instanceof ConfigurationError) {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = error instanceof NotYetImplementedError ? 2 : 1;
        return;
      }

      throw error;
    }
  }
}
