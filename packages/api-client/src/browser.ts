import { ApiClientError, apiClient } from "./client";
import type { Route } from "./generated";

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

export async function download(path: string, fallbackName: string) {
  const response = await fetch(path, { credentials: "same-origin" });
  if (!response.ok) {
    let message = "下载失败，请稍后重试";
    try {
      const body = await response.json();
      if (typeof body?.message === "string") message = body.message;
    } catch {
      message = "下载失败，请稍后重试";
    }
    throw new Error(message);
  }
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const named = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = named ?? fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
