import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@/core/services/security/auth", () => ({
  getServerSessionWithWorkspace: vi.fn(),
}));
vi.mock("@/core/services/security/rbac", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/services/security/rbac")>();
  return { ...actual, requireRole: vi.fn() };
});
vi.mock("@/core/db/repositories/contractRepo");
vi.mock("@/core/db/repositories/policyRepo");
vi.mock("@/core/db/repositories/workspaceRepo");
vi.mock("@/core/db/repositories/exceptionRepo");
vi.mock("@/core/services/risk/aggregateRisk");
vi.mock("@/core/services/risk/executiveSummary", () => ({
  buildExecutiveSummary: vi.fn(() => ({ headline: "NEEDS_REVIEW", paragraphs: [], keyRisks: [], recommendation: "" })),
}));
vi.mock("@/core/services/reports/executiveSummaryReport", () => ({
  buildExecutiveMarkdown: vi.fn((_m: unknown) => "# Executive Risk Summary\n\nMarkdown content"),
  buildExecutiveHtml: vi.fn((_m: unknown) => "<!DOCTYPE html><html><body>HTML content</body></html>"),
  buildExecutivePdf: vi.fn(() => Promise.resolve(new Uint8Array([0x25, 0x50, 0x44, 0x46]))),
}));
vi.mock("@/core/services/reports/executiveNarrativeAI", () => ({
  buildExecutiveNarrativeInput: vi.fn(),
  generateExecutiveNarrative: vi.fn(() => Promise.resolve("AI narrative")),
}));
vi.mock("@/core/services/ledger/ledgerService", () => ({ recordEvent: vi.fn().mockResolvedValue(undefined) }));

import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireRole, AuthError } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as policyRepo from "@/core/db/repositories/policyRepo";
import * as workspaceRepo from "@/core/db/repositories/workspaceRepo";
import * as exceptionRepo from "@/core/db/repositories/exceptionRepo";
import { aggregateRisk } from "@/core/services/risk/aggregateRisk";

const workspaceId = "ws-1";
const contractId = "c-1";
const versionId = "v-1";
const policyId = "p-1";

const viewerSession = {
  user: { id: "u-1", email: "v@test.com", name: null, image: null },
  userId: "u-1",
  email: "v@test.com" as string | null,
  currentWorkspaceId: workspaceId,
  role: "VIEWER" as const,
};

const legalSession = {
  ...viewerSession,
  role: "LEGAL" as const,
};

const contractDetail = {
  id: contractId,
  workspaceId,
  title: "Test Contract",
  counterparty: { name: "Acme" },
  contractType: "MSA",
  startDate: new Date("2024-01-01"),
  endDate: new Date("2025-12-31"),
  versions: [
    { id: versionId, versionNumber: 2, contractCompliance: [{ policyId, policy: { id: policyId, name: "Policy" } }] },
  ],
};

const aggregation = {
  contractId,
  contractVersionId: versionId,
  policyId,
  overallStatus: "NEEDS_REVIEW" as const,
  rawScore: 70,
  effectiveScore: 72,
  clusters: [{ riskType: "LEGAL" as const, level: "MEDIUM" as const, violationCount: 1, unclearCount: 0, overriddenCount: 0, maxSeverity: "HIGH" as const, totalWeight: 7, topDrivers: [{ clauseType: "LIABILITY", severity: "HIGH", weight: 7, reason: "Cap below policy" }] }],
  topDrivers: [{ clauseType: "LIABILITY", severity: "HIGH", weight: 7, reason: "Cap below policy" }],
  generatedAt: "2025-02-01T12:00:00.000Z",
};

describe("POST /api/contracts/[id]/executive-summary/export", () => {
  beforeEach(() => {
    vi.mocked(getServerSessionWithWorkspace).mockResolvedValue(viewerSession);
    vi.mocked(requireRole).mockImplementation(() => {});
    vi.mocked(contractRepo.getContractDetail).mockResolvedValue(contractDetail as Awaited<ReturnType<typeof contractRepo.getContractDetail>>);
    vi.mocked(policyRepo.findPolicyByWorkspaceAndId).mockResolvedValue({ id: policyId, workspaceId, name: "Policy" } as Awaited<ReturnType<typeof policyRepo.findPolicyByWorkspaceAndId>>);
    vi.mocked(workspaceRepo.findWorkspaceById).mockResolvedValue({ id: workspaceId, name: "Workspace" } as Awaited<ReturnType<typeof workspaceRepo.findWorkspaceById>>);
    vi.mocked(exceptionRepo.findApprovedExceptionsWithTitlesByContractVersion).mockResolvedValue([]);
    vi.mocked(aggregateRisk).mockResolvedValue(aggregation);
  });

  it("VIEWER can export html (200, text/html)", async () => {
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyId, versionId, format: "html", includeNarrative: false }),
      }),
      { params: Promise.resolve({ id: contractId }) }
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(vi.mocked(requireRole)).not.toHaveBeenCalled();
  });

  it("VIEWER can export md (200, text/markdown)", async () => {
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyId, versionId, format: "md", includeNarrative: false }),
      }),
      { params: Promise.resolve({ id: contractId }) }
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/markdown");
    expect(vi.mocked(requireRole)).not.toHaveBeenCalled();
  });

  it("VIEWER cannot export pdf (403)", async () => {
    vi.mocked(requireRole).mockImplementation(() => {
      throw new AuthError("Insufficient role", 403);
    });
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyId, versionId, format: "pdf", includeNarrative: false }),
      }),
      { params: Promise.resolve({ id: contractId }) }
    );
    expect(res.status).toBe(403);
    expect(vi.mocked(requireRole)).toHaveBeenCalledWith(
      expect.anything(),
      { allowedRoles: ["LEGAL", "RISK", "ADMIN"] }
    );
  });

  it("LEGAL can export pdf (200, application/pdf)", async () => {
    vi.mocked(getServerSessionWithWorkspace).mockResolvedValue(legalSession);
    vi.mocked(requireRole).mockImplementation(() => {});

    const res = await POST(
      new Request("http://x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyId, versionId, format: "pdf", includeNarrative: false }),
      }),
      { params: Promise.resolve({ id: contractId }) }
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain(".pdf");
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(0);
    expect(new Uint8Array(buf).slice(0, 4)).toEqual(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
  });

  it("returns 400 when policyId or versionId missing", async () => {
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId, format: "html" }),
      }),
      { params: Promise.resolve({ id: contractId }) }
    );
    expect(res.status).toBe(400);
  });
});
