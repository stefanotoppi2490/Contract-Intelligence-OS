import { describe, it, expect, vi, beforeEach } from "vitest";
import { aggregateRisk } from "./aggregateRisk";

vi.mock("@/core/db/repositories/clauseFindingRepo");
vi.mock("@/core/db/repositories/contractComplianceRepo");
vi.mock("@/core/db/repositories/exceptionRepo");

import * as clauseFindingRepo from "@/core/db/repositories/clauseFindingRepo";
import * as contractComplianceRepo from "@/core/db/repositories/contractComplianceRepo";
import * as exceptionRepo from "@/core/db/repositories/exceptionRepo";

describe("aggregateRisk", () => {
  const contractId = "c-1";
  const versionId = "v-1";
  const policyId = "p-1";

  beforeEach(() => {
    vi.mocked(contractComplianceRepo.findContractComplianceByVersionAndPolicy).mockResolvedValue({
      id: "cc-1",
      contractVersionId: versionId,
      policyId,
      score: 85,
      status: "NEEDS_REVIEW",
      policy: { id: policyId, name: "Policy" },
    } as Awaited<ReturnType<typeof contractComplianceRepo.findContractComplianceByVersionAndPolicy>>);
    vi.mocked(clauseFindingRepo.findManyClauseFindingsByContractVersion).mockResolvedValue([]);
    vi.mocked(exceptionRepo.findApprovedExceptionsByContractVersion).mockResolvedValue([]);
  });

  it("returns null when no compliance for version and policy", async () => {
    vi.mocked(contractComplianceRepo.findContractComplianceByVersionAndPolicy).mockResolvedValue(null);
    const result = await aggregateRisk({ contractId, contractVersionId: versionId, policyId });
    expect(result).toBeNull();
  });

  it("returns aggregation with correct cluster levels: VIOLATION → MEDIUM, UNCLEAR → NEEDS_REVIEW, else OK", async () => {
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
      {
        id: "f-2",
        clauseType: "DATA_PRIVACY",
        ruleId: "r-2",
        complianceStatus: "UNCLEAR",
        severity: "MEDIUM",
        riskType: "DATA",
        recommendation: null,
        rule: { policyId, weight: 3 },
      },
    ] as Awaited<ReturnType<typeof clauseFindingRepo.findManyClauseFindingsByContractVersion>>);

    const result = await aggregateRisk({ contractId, contractVersionId: versionId, policyId });
    expect(result).not.toBeNull();
    expect(result!.overallStatus).toBe("NEEDS_REVIEW");
    expect(result!.rawScore).toBe(85);
    expect(result!.effectiveScore).toBe(85);

    const legalCluster = result!.clusters.find((c) => c.riskType === "LEGAL");
    expect(legalCluster).toBeDefined();
    expect(legalCluster!.level).toBe("MEDIUM");
    expect(legalCluster!.violationCount).toBe(1);
    expect(legalCluster!.unclearCount).toBe(0);
    expect(legalCluster!.totalWeight).toBe(5);

    const dataCluster = result!.clusters.find((c) => c.riskType === "DATA");
    expect(dataCluster).toBeDefined();
    expect(dataCluster!.level).toBe("NEEDS_REVIEW");
    expect(dataCluster!.violationCount).toBe(0);
    expect(dataCluster!.unclearCount).toBe(1);
    expect(dataCluster!.totalWeight).toBe(0);
  });

  it("CRITICAL violation → cluster level HIGH", async () => {
    vi.mocked(clauseFindingRepo.findManyClauseFindingsByContractVersion).mockResolvedValue([
      {
        id: "f-1",
        clauseType: "LIABILITY",
        ruleId: "r-1",
        complianceStatus: "VIOLATION",
        severity: "CRITICAL",
        riskType: "LEGAL",
        recommendation: "Liability cap too low.",
        rule: { policyId, weight: 10 },
      },
    ] as Awaited<ReturnType<typeof clauseFindingRepo.findManyClauseFindingsByContractVersion>>);

    const result = await aggregateRisk({ contractId, contractVersionId: versionId, policyId });
    const legalCluster = result!.clusters.find((c) => c.riskType === "LEGAL");
    expect(legalCluster!.level).toBe("HIGH");
    expect(legalCluster!.maxSeverity).toBe("CRITICAL");
  });

  it("overriddenCount counts findings with approved exception", async () => {
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

    const result = await aggregateRisk({ contractId, contractVersionId: versionId, policyId });
    expect(result!.effectiveScore).toBe(90);
    const legalCluster = result!.clusters.find((c) => c.riskType === "LEGAL");
    expect(legalCluster!.overriddenCount).toBe(1);
  });
});
