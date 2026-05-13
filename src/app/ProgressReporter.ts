export interface ProgressReporterLike {
  report(message: string): void;
}

export class NullProgressReporter implements ProgressReporterLike {
  public report(): void {
    // Intentionally no-op.
  }
}

export class StdoutProgressReporter implements ProgressReporterLike {
  public report(message: string): void {
    process.stdout.write(`${message}\n`);
  }
}
