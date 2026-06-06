import { ApiError, toApiError } from "./errors.mjs";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface RequestJsonOptions {
  host: string;
  method: HttpMethod;
  path: string;
  token: string;
  body?: unknown;
  fetchImpl?: typeof fetch;
}

export interface AutodlResponse<T = unknown> {
  code?: string;
  msg?: string;
  data?: T;
  [key: string]: unknown;
}

function joinUrl(host: string, requestPath: string): string {
  const cleanHost = host.replace(/\/+$/, "");
  const cleanPath = requestPath.startsWith("/") ? requestPath : `/${requestPath}`;
  return `${cleanHost}${cleanPath}`;
}

async function parseResponseJson(response: Response): Promise<AutodlResponse> {
  try {
    return (await response.json()) as AutodlResponse;
  } catch (error) {
    throw new ApiError(
      "api_error",
      `Invalid JSON response: ${error instanceof Error ? error.message : String(error)}`,
      { status: response.status },
      3,
    );
  }
}

export async function requestJson<T = unknown>(
  options: RequestJsonOptions,
): Promise<AutodlResponse<T>> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const init: RequestInit = {
    method: options.method,
    headers: {
      Authorization: options.token,
      "Content-Type": "application/json",
    },
  };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetchImpl(joinUrl(options.host, options.path), init);
  } catch (error) {
    throw toApiError(error);
  }

  const json = await parseResponseJson(response);
  if (!response.ok) {
    throw new ApiError(
      "api_error",
      `API request failed: HTTP ${response.status}`,
      { status: response.status, response: json },
      3,
    );
  }
  if (json.code !== "Success") {
    throw new ApiError(
      "api_error",
      `AutoDL API returned ${String(json.code ?? "unknown")}: ${String(json.msg ?? "")}`.trim(),
      json,
      3,
    );
  }
  return json as AutodlResponse<T>;
}
