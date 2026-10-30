import { it, expect } from "vitest";
import { ApiClient, ApiClientError, buildRequest } from "./client";
it("encodes path and query independently and includes same-origin credentials", () => {
  const req = buildRequest(
    {
      name: "Get",
      method: "GET",
      path: "/api/v1/projects/:id",
      pathFields: ["id"],
      queryFields: ["page"],
      bodyFields: [],
    },
    { id: "a/b", page: 2 },
  );
  expect(req.url).toBe("/api/v1/projects/a%2Fb?page=2");
  expect(req.init.credentials).toBe("same-origin");
  expect(req.init.body).toBeUndefined();
});
it("returns structured errors without parsing display messages", async () => {
  const client = new ApiClient(
    async () =>
      new Response(
        JSON.stringify({
          code: "REVISION_CONFLICT",
          message: "内容已经在其他设备修改",
          requestId: "r1",
        }),
        { status: 409 },
      ),
  );
  await expect(
    client.request(
      {
        name: "Save",
        method: "PUT",
        path: "/api/v1/projects/:id",
        pathFields: ["id"],
        queryFields: [],
        bodyFields: ["document", "expectedRevision"],
      },
      { id: "p1", document: "{}", expectedRevision: "1" },
    ),
  ).rejects.toMatchObject({
    name: "ApiClientError",
    code: "REVISION_CONFLICT",
    status: 409,
    requestId: "r1",
  });
});
