import { ESLint } from "eslint";

const COMPLEXITY_MESSAGE_PATTERN = /complexity of (\d+)\. Maximum allowed is (\d+)\./;

async function main() {
  const eslint = new ESLint();
  const results = await eslint.lintFiles(["src/**/*.ts", "test/**/*.ts"]);

  const findings = [];

  for (const result of results) {
    for (const message of result.messages) {
      if (message.ruleId !== "complexity") {
        continue;
      }

      const match = message.message.match(COMPLEXITY_MESSAGE_PATTERN);
      const complexity = Number(match?.[1] ?? NaN);
      const maxAllowed = Number(match?.[2] ?? NaN);

      findings.push({
        filePath: result.filePath,
        line: message.line,
        complexity: Number.isFinite(complexity) ? complexity : -1,
        maxAllowed: Number.isFinite(maxAllowed) ? maxAllowed : -1,
      });
    }
  }

  if (findings.length === 0) {
    process.stdout.write("No complexity warnings found at the current threshold.\n");
    return;
  }

  findings.sort(
    (left, right) => right.complexity - left.complexity || left.filePath.localeCompare(right.filePath),
  );

  const byFile = new Map();
  for (const finding of findings) {
    const fileFindings = byFile.get(finding.filePath) ?? [];
    fileFindings.push(finding);
    byFile.set(finding.filePath, fileFindings);
  }

  process.stdout.write(`Complexity warnings: ${findings.length}\n`);
  process.stdout.write(`Files with warnings: ${byFile.size}\n\n`);

  process.stdout.write("Top complexity hotspots\n");
  for (const finding of findings.slice(0, 10)) {
    process.stdout.write(
      `- ${finding.filePath}:${finding.line} complexity=${finding.complexity} threshold=${finding.maxAllowed}\n`,
    );
  }

  process.stdout.write("\nHotspot summary by file\n");
  const sortedFiles = Array.from(byFile.entries()).sort((left, right) => {
    const leftPeak = Math.max(...left[1].map((finding) => finding.complexity));
    const rightPeak = Math.max(...right[1].map((finding) => finding.complexity));
    return rightPeak - leftPeak || left[0].localeCompare(right[0]);
  });

  for (const [filePath, fileFindings] of sortedFiles) {
    const peak = Math.max(...fileFindings.map((finding) => finding.complexity));
    process.stdout.write(`- ${filePath} warnings=${fileFindings.length} peak=${peak}\n`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
