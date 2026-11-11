import { ApiClientError, routes } from "@fastposter/api-client";
import type { ResourceDTO } from "@fastposter/api-client";
import { request } from "@fastposter/api-client/browser";

export {
  download,
  errorMessage,
  request,
} from "@fastposter/api-client/browser";

/** Another write advanced the snapshot version this form started from. */
export function isRevisionConflict(e: unknown): boolean {
  return e instanceof ApiClientError && e.code === "REVISION_CONFLICT";
}
/** An old cached page omits the version prerequisite entirely. */
export function isStaleClient(e: unknown): boolean {
  return (
    e instanceof ApiClientError &&
    e.code === "INVALID_INPUT" &&
    /版本|刷新页面/.test(e.message)
  );
}
/** Deleted resources or lost admin sessions stop the retry flow. */
export function isGone(e: unknown): boolean {
  return (
    e instanceof ApiClientError &&
    (e.code === "NOT_FOUND" ||
      e.code === "FORBIDDEN" ||
      e.code === "AUTH_REQUIRED")
  );
}
/** Reload the newest resource by ID after a conflict (admin detail route). */
export async function reloadResource(id: string): Promise<ResourceDTO> {
  const reply = await request(routes.AdminGetResource, { id });
  return reply.resource;
}
