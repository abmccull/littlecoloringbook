export class JobRunnerError extends Error {
  status: number;
  details?: Record<string, unknown> | null;

  constructor(message: string, status = 500, details?: Record<string, unknown> | null) {
    super(message);
    this.name = "JobRunnerError";
    this.status = status;
    this.details = details ?? null;
  }
}

export function isJobRunnerError(error: unknown): error is JobRunnerError {
  return error instanceof JobRunnerError;
}
