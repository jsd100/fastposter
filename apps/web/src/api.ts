import { ApiClientError, apiClient, type Route } from "@fastposter/api-client";
export async function request<Q, R>(route: Route<Q, R>, input: Q): Promise<R> {
  try {
    return await apiClient.request(route, input);
  } catch (e) {
    if (e instanceof ApiClientError && e.code === "AUTH_REQUIRED")
      window.dispatchEvent(new Event("session-expired"));
    throw e;
  }
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求未能完成，请稍后重试";
}
