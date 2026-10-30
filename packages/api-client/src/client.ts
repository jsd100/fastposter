import type { Route } from "./generated";
export class ApiClientError extends Error {
  readonly name = "ApiClientError";
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly requestId: string,
  ) {
    super(message);
  }
}
export function buildRequest<Q, R>(
  route: Route<Q, R>,
  input: Q,
): { url: string; init: RequestInit } {
  const data = (input ?? {}) as Record<string, unknown>;
  let path = route.path;
  for (const name of route.pathFields) {
    if (data[name] === undefined || data[name] === null)
      throw Error(`Missing path parameter: ${name}`);
    path = path.replace(":" + name, encodeURIComponent(String(data[name])));
  }
  const query = new URLSearchParams();
  for (const name of route.queryFields)
    if (data[name] !== undefined && data[name] !== null)
      query.set(name, String(data[name]));
  const body = Object.fromEntries(
    route.bodyFields
      .filter((name) => data[name] !== undefined)
      .map((name) => [name, data[name]]),
  );
  return {
    url: path + (query.size ? "?" + query.toString() : ""),
    init: {
      method: route.method,
      credentials: "same-origin",
      headers:
        route.method === "GET"
          ? undefined
          : { "Content-Type": "application/json" },
      body: route.method === "GET" ? undefined : JSON.stringify(body),
    },
  };
}
export class ApiClient {
  constructor(
    private readonly transport: typeof fetch = globalThis.fetch.bind(
      globalThis,
    ),
  ) {}
  async request<Q, R>(route: Route<Q, R>, input: Q): Promise<R> {
    const { url, init } = buildRequest(route, input);
    return this.decode<R>(await this.transport(url, init));
  }
  async upload<R>(path: string, form: FormData): Promise<R> {
    return this.decode<R>(
      await this.transport(path, {
        method: "POST",
        credentials: "same-origin",
        body: form,
      }),
    );
  }
  private async decode<R>(response: Response): Promise<R> {
    let value: any;
    try {
      value = await response.json();
    } catch {
      throw new ApiClientError(
        "INVALID_RESPONSE",
        "服务器返回了无法识别的响应",
        response.status,
        "",
      );
    }
    if (!response.ok)
      throw new ApiClientError(
        value.code ?? "REQUEST_FAILED",
        value.message ?? "请求失败",
        response.status,
        value.requestId ?? "",
      );
    return value as R;
  }
}
export const apiClient = new ApiClient();
