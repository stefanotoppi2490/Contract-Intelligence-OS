import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeDealDecisionPreview } from "./dealDecisionEngine";

vi.mock("@/core/db/repositories/contractComplianceRepo");
vi.mock("@/core/db/repositories/clauseFindingRepo");
vi.mock("@/core/db/repositories/exceptionRepo");

import * as contractComplianceRepo from "@/core/db/repositories/contractComplianceRepo";
import * as clauseFindingRepo from "@/core/db/repositories/clauseFindingRepo";
import * as exceptionRepo from "@/core/db/repositories/exceptionRepo";

describe("dealDecisionEngine", () => {
  const contractId = "c-1";
  const versionId = "v-1";
  const policyId = "p-1";

  function mockCompliance(score: number) {
    return {
      id: "cc-1",
      contractVersionId: versionId,
      policyId,
      score,
      status: "NEEDS_REVIEW",
      policy: { id: policyId, name: "Policy" },
    } as Awaited<ReturnType<typeof contractComplianceRepo.findContractComplianceByVersionAndPolicy>>;
  }

  beforeEach(() => {
    vi.mocked(contractComplianceRepo.findContractComplianceByVersionAndPolicy).mockResolvedValue(
      mockCompliance(80)
    );
    vi.mocked(clauseFindingRepo.findManyClauseFindingsByContractVersion).mockResolvedValue([]);
    vi.mocked(exceptionRepo.findApprovedExceptionsByContractVersion).mockResolvedValue([]);
    vi.mocked(exceptionRepo.findManyExceptionRequestsByContractVersion).mockResolvedValue([]);
  });

  it("returns null when no compliance for version and policy", async () => {
    vi.mocked(contractComplianceRepo.findContractComplianceByVersionAndPolicy).mockResolvedValue(null);
    const result = await computeDealDecisionPreview(contractId, versionId, policyId);
    expect(result).toBeNull();
  });

  it("critical violation => NO_GO", async () => {
    vi.mocked(clauseFindingRepo.findManyClauseFindingsByContractVersion).mockResolvedValue([
      {
        id: "f-1",
        clauseType: "LIABILITY",
        ruleId: "r-1",
        complianceStatus: "VIOLATION",
        severity: "CRITICAL",
        riskType: "LEGAL",
        recommendation: "Cap too low.",
        rule: { policyId, weight: 12 },
      },
    ] as Awaited<ReturnType<typeof clauseFindingRepo.findManyClauseFindingsByContractVersion>>);
    const result = await computeDealDecisionPreview(contractId, versionId, policyId);
    expect(result).not.toBeNull();
    expect(result!.outcome).toBe("NO_GO");
    expect(result!.counts.criticalViolations).toBe(1);
    expect(result!.counts.violations).toBe(1);
  });

  it("effectiveScore < 60 => NO_GO", async () => {
    vi.mocked(contractComplianceRepo.findContractComplianceByVersionAndPolicy).mockResolvedValue(
      mockCompliance(55)
    );
    vi.mocked(clauseFindingRepo.findManyClauseFindingsByContractVersion).mockResolvedValue([
      {
        id: "f-1",
        clauseType: "TERMINATION",
        ruleId: "r-1",
        complianceStatus: "VIOLATION",
        severity: "HIGH",
        riskType: "LEGAL",
        recommendation: "Clause required.",
        rule: { policyId, weight: 5 },
      },
    ] as Awaited<ReturnType<typeof clauseFindingRepo.findManyClauseFindingsByContractVersion>>);
    const result = await computeDealDecisionPreview(contractId, versionId, policyId);
    expect(result).not.toBeNull();
    expect(result!.outcome).toBe("NO_GO");
  });

  it("violations > 0 (no critical) => NEEDS_REVIEW", async () => {
    vi.mocked(clauseFindingRepo.findManyClauseFindingsByContractVersion).mockResolvedValue([
      {
        id: "f-1",
        clauseType: "TERMINATION",
        ruleId: "r-1",
        complianceStatus: "VIOLATION",
        severity: "HIGH",
        riskType: "LEGAL",
        recommendation: "Clause required.",
        rule: { policyId, weight: 5 },
      },
    ] as Awaited<ReturnType<typeof clauseFindingRepo.findManyClauseFindingsByContractVersion>>);
    const result = await computeDealDecisionPreview(contractId, versionId, policyId);
    expect(result).not.toBeNull();
    expect(result!.outcome).toBe("NEEDS_REVIEW");
    expect(result!.counts.violations).toBe(1);
    expect(result!.counts.criticalViolations).toBe(0);
  });

  it("unclear > 0 => NEEDS_REVIEW", async () => {
    vi.mocked(clauseFindingRepo.findManyClauseFindingsByContractVersion).mockResolvedValue([
      {
        id: "f-1",
        clauseType: "DATA_PRIVACY",
        ruleId: "r-1",
        complianceStatus: "UNCLEAR",
        severity: "MEDIUM",
        riskType: "DATA",
        recommendation: null,
        rule: { policyId, weight: 3 },
      },
    ] as Awaited<ReturnType<typeof clauseFindingRepo.findManyClauseFindingsByContractVersion>>);
    const result = await computeDealDecisionPreview(contractId, versionId, policyId);
    expect(result).not.toBeNull();
    expect(result!.outcome).toBe("NEEDS_REVIEW");
    expect(result!.counts.unclear).toBe(1);
  });

  it("openExceptions > 0 => NEEDS_REVIEW", async () => {
    vi.mocked(exceptionRepo.findManyExceptionRequestsByContractVersion).mockResolvedValue([
      { id: "ex-1", status: "REQUESTED", policyId },
    ] as Awaited<ReturnType<typeof exceptionRepo.findManyExceptionRequestsByContractVersion>>);
    const result = await computeDealDecisionPreview(contractId, versionId, policyId);
    expect(result).not.toBeNull();
    expect(result!.outcome).toBe("NEEDS_REVIEW");
    expect(result!.counts.openExceptions).toBe(1);
  });

  it("else => GO", async () => {
    const result = await computeDealDecisionPreview(contractId, versionId, policyId);
    expect(result).not.toBeNull();
    expect(result!.outcome).toBe("GO");
    expect(result!.effectiveScore).toBe(80);
    expect(result!.counts.violations).toBe(0);
    expect(result!.counts.unclear).toBe(0);
    expect(result!.counts.openExceptions).toBe(0);
  });

  it("overridden violations do not count toward outcome", async () => {
    vi.mocked(clauseFindingRepo.findManyClauseFindingsByContractVersion).mockResolvedValue([
      {
        id: "f-1",
        clauseType: "TERMINATION",
        ruleId: "r-1",
        complianceStatus: "VIOLATION",
        severity: "HIGH",
        riskType: "LEGAL",
        recommendation: "Clause required.",
        rule: { policyId, weight: 5 },
      },
    ] as Awaited<ReturnType<typeof clauseFindingRepo.findManyClauseFindingsByContractVersion>>);
    vi.mocked(exceptionRepo.findApprovedExceptionsByContractVersion).mockResolvedValue([
      { id: "ex-1", clauseFindingId: "f-1" },
    ] as Awaited<ReturnType<typeof exceptionRepo.findApprovedExceptionsByContractVersion>>);
    const result = await computeDealDecisionPreview(contractId, versionId, policyId);
    expect(result).not.toBeNull();
    expect(result!.outcome).toBe("GO");
    expect(result!.counts.violations).toBe(0);
    expect(result!.counts.overridden).toBe(1);
    expect(result!.effectiveScore).toBe(85);
  });

  it("returns rationaleMarkdown and topDrivers", async () => {
    vi.mocked(clauseFindingRepo.findManyClauseFindingsByContractVersion).mockResolvedValue([
      {
        id: "f-1",
        clauseType: "LIABILITY",
        ruleId: "r-1",
        complianceStatus: "VIOLATION",
        severity: "HIGH",
        riskType: "LEGAL",
        recommendation: "Cap too low.",
        rule: { policyId, weight: 7 },
      },
    ] as Awaited<ReturnType<typeof clauseFindingRepo.findManyClauseFindingsByContractVersion>>);
    const result = await computeDealDecisionPreview(contractId, versionId, policyId);
    expect(result).not.toBeNull();
    expect(result!.rationaleMarkdown).toContain("Effective score");
    expect(result!.rationaleMarkdown).toContain("Violations:");
    expect(result!.topDrivers).toHaveLength(1);
    expect(result!.topDrivers[0].clauseType).toBe("LIABILITY");
    expect(result!.topDrivers[0].riskType).toBe("LEGAL");
    expect(result!.riskTypeBreakdown).toBeDefined();
    expect(result!.riskTypeBreakdown.LEGAL).toEqual({ violations: 1, unclear: 0 });
  });
});
