import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/core/services/security/auth", () => ({
  getServerSessionWithWorkspace: vi.fn(),
}));
vi.mock("@/core/services/security/rbac", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/services/security/rbac")>();
  return { ...actual, requireWorkspace: vi.fn() };
});
vi.mock("@/core/db/repositories/ledgerRepo");

import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, AuthError } from "@/core/services/security/rbac";
import * as ledgerRepo from "@/core/db/repositories/ledgerRepo";

describe("GET /api/ledger", () => {
  const workspaceId = "ws-1";

  beforeEach(() => {
    vi.mocked(getServerSessionWithWorkspace).mockResolvedValue({
      userId: "u-1",
      currentWorkspaceId: workspaceId,
      role: "VIEWER",
    } as Awaited<ReturnType<typeof getServerSessionWithWorkspace>>);
    vi.mocked(requireWorkspace).mockImplementation(() => {});
    vi.mocked(ledgerRepo.findManyLedgerEventsByWorkspace).mockResolvedValue([]);
  });

  it("returns 403 when no workspace", async () => {
    vi.mocked(requireWorkspace).mockImplementation(() => {
      throw new AuthError("No workspace", 403);
    });
    const res = await GET(new Request("http://x"));
    expect(res.status).toBe(403);
  });

  it("returns 200 with events list", async () => {
    vi.mocked(ledgerRepo.findManyLedgerEventsByWorkspace).mockResolvedValue([
      {
        id: "ev-1",
        workspaceId,
        type: "ANALYSIS_RUN",
        entityType: "ContractCompliance",
        entityId: "v-1",
        contractId: "c-1",
        contractVersionId: "v-1",
        policyId: "p-1",
        metadata: { rawScore: 85 },
        createdAt: new Date(),
      },
    ] as Awaited<ReturnType<typeof ledgerRepo.findManyLedgerEventsByWorkspace>>);
    const res = await GET(new Request("http://x"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.events).toHaveLength(1);
    expect(json.events[0].type).toBe("ANALYSIS_RUN");
    expect(json.events[0].metadata).toEqual({ rawScore: 85 });
  });
});
