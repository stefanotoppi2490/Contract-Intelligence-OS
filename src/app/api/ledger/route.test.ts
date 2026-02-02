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
vi.mock("@/core/db/repositories/contractRepo");
vi.mock("@/core/db/repositories/policyRepo");
vi.mock("@/core/db/repositories/exceptionRepo");
vi.mock("@/core/db/repositories/userRepo");

import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, AuthError } from "@/core/services/security/rbac";
import * as ledgerRepo from "@/core/db/repositories/ledgerRepo";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as policyRepo from "@/core/db/repositories/policyRepo";
import * as exceptionRepo from "@/core/db/repositories/exceptionRepo";
import * as userRepo from "@/core/db/repositories/userRepo";

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
    vi.mocked(contractRepo.findManyContractsByIds).mockResolvedValue([]);
    vi.mocked(policyRepo.findManyPoliciesByIds).mockResolvedValue([]);
    vi.mocked(exceptionRepo.findManyExceptionRequestsByIds).mockResolvedValue([]);
    vi.mocked(userRepo.findManyUsersByIds).mockResolvedValue([]);
  });

  it("returns 403 when no workspace", async () => {
    vi.mocked(requireWorkspace).mockImplementation(() => {
      throw new AuthError("No workspace", 403);
    });
    const res = await GET(new Request("http://x"));
    expect(res.status).toBe(403);
  });

  it("returns 200 with events list including summary", async () => {
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
    vi.mocked(contractRepo.findManyContractsByIds).mockResolvedValue([]);
    vi.mocked(policyRepo.findManyPoliciesByIds).mockResolvedValue([
      { id: "p-1", name: "Default Policy" },
    ] as Awaited<ReturnType<typeof policyRepo.findManyPoliciesByIds>>);
    vi.mocked(exceptionRepo.findManyExceptionRequestsByIds).mockResolvedValue([]);
    vi.mocked(userRepo.findManyUsersByIds).mockResolvedValue([]);
    const res = await GET(new Request("http://x"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.events).toHaveLength(1);
    expect(json.events[0].type).toBe("ANALYSIS_RUN");
    expect(json.events[0].metadata).toEqual({ rawScore: 85 });
    expect(json.events[0].summary).toBe("Analysis run: Default Policy — score 85 → 85");
  });
});
