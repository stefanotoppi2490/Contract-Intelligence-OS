import { describe, it, expect, vi, beforeEach } from "vitest";
import { compareVersions } from "./versionCompare";

vi.mock("@/core/db/repositories/contractRepo");
vi.mock("@/core/db/repositories/contractComplianceRepo");
vi.mock("@/core/db/repositories/clauseFindingRepo");
vi.mock("@/core/db/repositories/exceptionRepo");

import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as contractComplianceRepo from "@/core/db/repositories/contractComplianceRepo";
import * as clauseFindingRepo from "@/core/db/repositories/clauseFindingRepo";
import * as exceptionRepo from "@/core/db/repositories/exceptionRepo";

const workspaceId = "ws-1";
const contractId = "c-1";
const fromVersionId = "v-from";
const toVersionId = "v-to";
const policyId = "p-1";

function makeContract(versions: { id: string; versionNumber: number }[]) {
  return {
    id: contractId,
    workspaceId,
    title: "Test Contract",
    versions: versions.map((v) => ({ id: v.id, versionNumber: v.versionNumber })),
  } as Awaited<ReturnType<typeof contractRepo.getContractDetail>>;
}

function makeCompliance(score: number) {
  return {
    score,
    policyId,
    policy: { id: policyId, name: "Policy" },
  } as Awaited<ReturnType<typeof contractComplianceRepo.findContractComplianceByVersionAndPolicy>>;
}

function makeFinding(overrides: {
  id: string;
  clauseType: string;
  ruleId?: string;
  complianceStatus: string;
  foundValue?: unknown;
  foundText?: string | null;
  rule?: { policyId?: string; weight?: number };
}) {
  return {
    id: overrides.id,
    clauseType: overrides.clauseType,
    ruleId: overrides.ruleId ?? overrides.clauseType,
    complianceStatus: overrides.complianceStatus,
    foundValue: overrides.foundValue ?? null,
    foundText: overrides.foundText ?? null,
    confidence: null,
    rule: overrides.rule ?? { policyId, weight: 1 },
    recommendation: null,
    severity: null,
    riskType: null,
  } as Awaited<ReturnType<typeof clauseFindingRepo.findManyClauseFindingsByContractVersion>>[number];
}

describe("versionCompare", () => {
  beforeEach(() => {
    vi.mocked(contractRepo.getContractDetail).mockResolvedValue(
      makeContract([
        { id: fromVersionId, versionNumber: 1 },
        { id: toVersionId, versionNumber: 2 },
      ])
    );
    vi.mocked(contractComplianceRepo.findContractComplianceByVersionAndPolicy).mockImplementation(
      ((contractVersionId: string) =>
        Promise.resolve(
          contractVersionId === fromVersionId || contractVersionId === toVersionId
            ? makeCompliance(80)
            : null
        )) as unknown as (contractVersionId: string, policyId: string) => ReturnType<typeof contractComplianceRepo.findContractComplianceByVersionAndPolicy>
    );
    vi.mocked(exceptionRepo.findApprovedExceptionsByContractVersion).mockResolvedValue(
      [] as Awaited<ReturnType<typeof exceptionRepo.findApprovedExceptionsByContractVersion>>
    );
  });

  it("returns MISSING_ANALYSIS when from version has no compliance", async () => {
    vi.mocked(contractComplianceRepo.findContractComplianceByVersionAndPolicy).mockImplementation(
      ((contractVersionId: string) =>
        Promise.resolve(contractVersionId === toVersionId ? makeCompliance(80) : null)) as unknown as (
        contractVersionId: string,
        policyId: string
      ) => ReturnType<typeof contractComplianceRepo.findContractComplianceByVersionAndPolicy>
    );
    vi.mocked(clauseFindingRepo.findManyClauseFindingsByContractVersion).mockResolvedValue(
      [] as Awaited<ReturnType<typeof clauseFindingRepo.findManyClauseFindingsByContractVersion>>
    );

    const outcome = await compareVersions({
      workspaceId,
      contractId,
      fromVersionId,
      toVersionId,
      policyId,
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.code).toBe("MISSING_ANALYSIS");
      expect(outcome.missingVersionId).toBe(fromVersionId);
    }
  });

  it("returns MISSING_ANALYSIS when to version has no compliance", async () => {
    vi.mocked(contractComplianceRepo.findContractComplianceByVersionAndPolicy).mockImplementation(
      ((contractVersionId: string) =>
        Promise.resolve(contractVersionId === fromVersionId ? makeCompliance(80) : null)) as unknown as (
        contractVersionId: string,
        policyId: string
      ) => ReturnType<typeof contractComplianceRepo.findContractComplianceByVersionAndPolicy>
    );
    vi.mocked(clauseFindingRepo.findManyClauseFindingsByContractVersion).mockResolvedValue(
      [] as Awaited<ReturnType<typeof clauseFindingRepo.findManyClauseFindingsByContractVersion>>
    );

    const outcome = await compareVersions({
      workspaceId,
      contractId,
      fromVersionId,
      toVersionId,
      policyId,
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.code).toBe("MISSING_ANALYSIS");
      expect(outcome.missingVersionId).toBe(toVersionId);
    }
  });

  it("detects MODIFIED when foundValue differs (JSON)", async () => {
    vi.mocked(clauseFindingRepo.findManyClauseFindingsByContractVersion).mockImplementation(
      ((contractVersionId: string) => {
        const rule = { policyId, weight: 3 };
        if (contractVersionId === fromVersionId) {
          return Promise.resolve([
            makeFinding({
              id: "f-1",
              clauseType: "TERMINATION_NOTICE",
              ruleId: "r-1",
              complianceStatus: "COMPLIANT",
              foundValue: { noticeDays: 5 },
              rule,
            }),
          ]);
        }
        return Promise.resolve([
          makeFinding({
            id: "f-2",
            clauseType: "TERMINATION_NOTICE",
            ruleId: "r-1",
            complianceStatus: "COMPLIANT",
            foundValue: { noticeDays: 30 },
            rule,
          }),
        ]);
      }) as typeof clauseFindingRepo.findManyClauseFindingsByContractVersion
    );

    const outcome = await compareVersions({
      workspaceId,
      contractId,
      fromVersionId,
      toVersionId,
      policyId,
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      const modified = outcome.result.changes.filter((c) => c.changeType === "MODIFIED");
      expect(modified.length).toBeGreaterThanOrEqual(1);
      expect(modified.some((c) => c.clauseType === "TERMINATION_NOTICE" && c.why)).toBe(true);
    }
  });

  it("detects status change VIOLATION → COMPLIANT", async () => {
    vi.mocked(contractComplianceRepo.findContractComplianceByVersionAndPolicy).mockImplementation(
      ((contractVersionId: string) =>
        Promise.resolve(makeCompliance(contractVersionId === fromVersionId ? 70 : 80))) as unknown as (
        contractVersionId: string,
        policyId: string
      ) => ReturnType<typeof contractComplianceRepo.findContractComplianceByVersionAndPolicy>
    );
    vi.mocked(clauseFindingRepo.findManyClauseFindingsByContractVersion).mockImplementation(
      ((contractVersionId: string) => {
        const rule = { policyId, weight: 5 };
        if (contractVersionId === fromVersionId) {
          return Promise.resolve([
            makeFinding({
              id: "f-1",
              clauseType: "LIABILITY_CAP",
              ruleId: "r-1",
              complianceStatus: "VIOLATION",
              foundValue: 1,
              rule,
            }),
          ]);
        }
        return Promise.resolve([
          makeFinding({
            id: "f-2",
            clauseType: "LIABILITY_CAP",
            ruleId: "r-1",
            complianceStatus: "COMPLIANT",
            foundValue: 2,
            rule,
          }),
        ]);
      }) as typeof clauseFindingRepo.findManyClauseFindingsByContractVersion
    );

    const outcome = await compareVersions({
      workspaceId,
      contractId,
      fromVersionId,
      toVersionId,
      policyId,
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      const modified = outcome.result.changes.filter((c) => c.changeType === "MODIFIED");
      expect(modified.some((c) => c.from?.status === "VIOLATION" && c.to?.status === "COMPLIANT")).toBe(true);
      expect(outcome.result.delta.label).toBe("IMPROVED");
    }
  });

  it("topDrivers sorted by abs(deltaImpact) desc, top 5", async () => {
    vi.mocked(contractComplianceRepo.findContractComplianceByVersionAndPolicy).mockResolvedValue(
      makeCompliance(70) as Awaited<ReturnType<typeof contractComplianceRepo.findContractComplianceByVersionAndPolicy>>
    );
    vi.mocked(clauseFindingRepo.findManyClauseFindingsByContractVersion).mockImplementation(
      ((contractVersionId: string) => {
        const fromFindings = [
          makeFinding({
            id: "f-a",
            clauseType: "A",
            ruleId: "r-a",
            complianceStatus: "VIOLATION",
            rule: { policyId, weight: 1 },
          }),
          makeFinding({
            id: "f-b",
            clauseType: "B",
            ruleId: "r-b",
            complianceStatus: "VIOLATION",
            rule: { policyId, weight: 5 },
          }),
          makeFinding({
            id: "f-c",
            clauseType: "C",
            ruleId: "r-c",
            complianceStatus: "VIOLATION",
            rule: { policyId, weight: 3 },
          }),
        ];
        const toFindings = [
          makeFinding({
            id: "f-b2",
            clauseType: "B",
            ruleId: "r-b",
            complianceStatus: "COMPLIANT",
            rule: { policyId, weight: 5 },
          }),
          makeFinding({
            id: "f-c2",
            clauseType: "C",
            ruleId: "r-c",
            complianceStatus: "COMPLIANT",
            rule: { policyId, weight: 3 },
          }),
        ];
        if (contractVersionId === fromVersionId) return Promise.resolve(fromFindings);
        return Promise.resolve(toFindings);
      }) as typeof clauseFindingRepo.findManyClauseFindingsByContractVersion
    );

    const outcome = await compareVersions({
      workspaceId,
      contractId,
      fromVersionId,
      toVersionId,
      policyId,
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.topDrivers.length).toBeLessThanOrEqual(5);
      const impacts = outcome.result.topDrivers.map((d) => d.deltaImpact);
      for (let i = 1; i < impacts.length; i++) {
        expect(Math.abs(impacts[i]!)).toBeLessThanOrEqual(Math.abs(impacts[i - 1]!));
      }
    }
  });

  it("effective delta accounts for overridden findings (approved exceptions)", async () => {
    vi.mocked(contractComplianceRepo.findContractComplianceByVersionAndPolicy).mockImplementation(
      ((contractVersionId: string) =>
        Promise.resolve(makeCompliance(contractVersionId === fromVersionId ? 75 : 75))) as unknown as (
        contractVersionId: string,
        policyId: string
      ) => ReturnType<typeof contractComplianceRepo.findContractComplianceByVersionAndPolicy>
    );
    vi.mocked(clauseFindingRepo.findManyClauseFindingsByContractVersion).mockImplementation(
      ((contractVersionId: string) => {
        const rule = { policyId, weight: 10 };
        const finding = makeFinding({
          id: contractVersionId === fromVersionId ? "f-1" : "f-2",
          clauseType: "DATA_RETENTION",
          ruleId: "r-1",
          complianceStatus: "VIOLATION",
          rule,
        });
        return Promise.resolve([finding]);
      }) as typeof clauseFindingRepo.findManyClauseFindingsByContractVersion
    );
    vi.mocked(exceptionRepo.findApprovedExceptionsByContractVersion).mockImplementation(
      ((contractVersionId: string) => {
        if (contractVersionId === fromVersionId) {
          return Promise.resolve([{ id: "ex-1", clauseFindingId: "f-1" }]);
        }
        return Promise.resolve([]);
      }) as typeof exceptionRepo.findApprovedExceptionsByContractVersion
    );

    const outcome = await compareVersions({
      workspaceId,
      contractId,
      fromVersionId,
      toVersionId,
      policyId,
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.from.effectiveScore).toBe(85);
      expect(outcome.result.to.effectiveScore).toBe(75);
      expect(outcome.result.delta.effective).toBe(-10);
      expect(outcome.result.delta.label).toBe("WORSENED");
    }
  });
});
