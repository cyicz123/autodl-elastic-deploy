export type ErrorDetails = Record<string, unknown>;

export class ApiError extends Error {
  errorType: string;
  details: ErrorDetails;
  exitCode: number;

  constructor(
    errorType: string,
    message: string,
    details: ErrorDetails = {},
    exitCode = 3,
  ) {
    super(message);
    this.name = "ApiError";
    this.errorType = errorType;
    this.details = details;
    this.exitCode = exitCode;
  }
}

export function toApiError(error: unknown, fallbackMessage = "API request failed"): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  return new ApiError("api_error", `${fallbackMessage}: ${message}`, {}, 3);
}
