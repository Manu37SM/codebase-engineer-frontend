import { describe, it, expect, vi, afterEach } from "vitest";
import { listProjects, createProject, listFiles, getAudit, getAuditExportUrl, ApiError } from "./api";

function mockFetchOnce(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

describe("api client", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("listProjects fetches /api/v1/projects", async () => {
    const fetchMock = mockFetchOnce({ projects: [{ id: "1", name: "a", root_path: "/a", created_at: "now" }] });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await listProjects();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/projects", expect.any(Object));
    expect(result.projects).toHaveLength(1);
  });

  it("createProject posts name and rootPath as JSON", async () => {
    const fetchMock = mockFetchOnce({ project: { id: "1", name: "a", root_path: "/a", created_at: "now" } }, 201);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await createProject("a", "/a");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ name: "a", rootPath: "/a" });
  });

  it("listFiles builds a query string from provided filters", async () => {
    const fetchMock = mockFetchOnce({ files: [], total: 0 });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await listFiles("proj-1", { language: "TypeScript", isTest: true, limit: 10, offset: 5 });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "/api/v1/projects/proj-1/files?language=TypeScript&isTest=true&limit=10&offset=5"
    );
  });

  it("throws ApiError with the server's error message on a non-ok response", async () => {
    const fetchMock = mockFetchOnce({ error: "Project not found" }, 404);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(listProjects()).rejects.toThrow(ApiError);
    await expect(listProjects()).rejects.toThrow("Project not found");
  });

  it("getAudit fetches /api/v1/projects/:id/audit", async () => {
    const fetchMock = mockFetchOnce({ project: { id: "1" }, generatedAt: "now" });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await getAudit("proj-1");
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/projects/proj-1/audit", expect.any(Object));
  });

  it("getAuditExportUrl builds the export path without fetching", () => {
    expect(getAuditExportUrl("proj-1")).toBe("/api/v1/projects/proj-1/audit/export");
  });
});
