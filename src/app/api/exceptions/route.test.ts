import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/core/services/security/auth", () => ({
  getServerSessionWithWorkspace: vi.fn(),
}));
vi.mock("@/core/services/security/rbac", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/services/security/rbac")>();
  return { ...actual, requireWorkspace: vi.fn() };
});
vi.mock("@/core/db/repositories/exceptionRepo");
vi.mock("@/core/db/repositories/userRepo");

import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, AuthError } from "@/core/services/security/rbac";
import * as exceptionRepo from "@/core/db/repositories/exceptionRepo";
import * as userRepo from "@/core/db/repositories/userRepo";

describe("GET /api/exceptions", () => {
  const workspaceId = "ws-1";

  beforeEach(() => {
    vi.mocked(getServerSessionWithWorkspace).mockResolvedValue({
      userId: "u-1",
      currentWorkspaceId: workspaceId,
      role: "VIEWER",
    } as Awaited<ReturnType<typeof getServerSessionWithWorkspace>>);
    vi.mocked(requireWorkspace).mockImplementation(() => {});
    vi.mocked(exceptionRepo.findManyExceptionRequestsByWorkspace).mockResolvedValue([]);
    vi.mocked(userRepo.findManyUsersByIds).mockResolvedValue([]);
  });

  it("returns 403 when no workspace", async () => {
    vi.mocked(requireWorkspace).mockImplementation(() => {
      throw new AuthError("No workspace", 403);
    });
    const res = await GET(new Request("http://x"));
    expect(res.status).toBe(403);
  });

  it("returns 200 with exceptions list for VIEWER", async () => {
    vi.mocked(exceptionRepo.findManyExceptionRequestsByWorkspace).mockResolvedValue([
      {
        id: "ex-1",
        workspaceId,
        contractId: "c-1",
        contractVersionId: "v-1",
        title: "Test",
        justification: "Reason",
        requestedByUserId: "u-1",
        status: "REQUESTED",
        createdAt: new Date(),
        updatedAt: new Date(),
        contractVersion: { contract: { title: "Contract A" } },
      },
    ] as Awaited<ReturnType<typeof exceptionRepo.findManyExceptionRequestsByWorkspace>>);
    const res = await GET(new Request("http://x"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.exceptions).toHaveLength(1);
    expect(json.exceptions[0].id).toBe("ex-1");
    expect(json.exceptions[0].status).toBe("REQUESTED");
  });
});
