import { describe, it, expect, vi, beforeEach } from "vitest";
import { analyze } from "./policyEngine";

vi.mock("@/core/db/repositories/policyRepo");
vi.mock("@/core/db/repositories/policyRuleRepo");
vi.mock("@/core/db/repositories/clauseFindingRepo");
vi.mock("@/core/db/repositories/contractComplianceRepo");

import * as policyRepo from "@/core/db/repositories/policyRepo";
import * as policyRuleRepo from "@/core/db/repositories/policyRuleRepo";
import * as clauseFindingRepo from "@/core/db/repositories/clauseFindingRepo";
import * as contractComplianceRepo from "@/core/db/repositories/contractComplianceRepo";

const policyId = "policy-1";
const versionId = "version-1";

function makeRule(overrides: {
  id: string;
  ruleType: "REQUIRED" | "FORBIDDEN" | "MIN_VALUE" | "MAX_VALUE" | "ALLOWED_VALUES";
  weight?: number;
  severity?: string | null;
  clauseType?: string;
  riskType?: string | null;
}) {
  return {
    id: overrides.id,
    policyId,
    clauseType: overrides.clauseType ?? "TERMINATION",
    ruleType: overrides.ruleType,
    expectedValue: null,
    severity: overrides.severity ?? null,
    riskType: overrides.riskType ?? null,
    weight: overrides.weight ?? 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("policyEngine", () => {
  beforeEach(() => {
    vi.mocked(policyRepo.findPolicyById).mockResolvedValue({
      id: policyId,
      workspaceId: "ws-1",
      name: "Test Policy",
      description: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Awaited<ReturnType<typeof policyRepo.findPolicyById>>);
    vi.mocked(policyRuleRepo.findManyPolicyRulesByPolicyId).mockResolvedValue([]);
    vi.mocked(clauseFindingRepo.upsertClauseFinding).mockResolvedValue({} as never);
    vi.mocked(contractComplianceRepo.upsertContractCompliance).mockResolvedValue({} as never);
  });

  describe("REQUIRED rule", () => {
    it("evaluates REQUIRED rule with no clause as VIOLATION", async () => {
      vi.mocked(policyRuleRepo.findManyPolicyRulesByPolicyId).mockResolvedValue([
        makeRule({ id: "rule-1", ruleType: "REQUIRED", weight: 10 }),
      ]);

      const result = await analyze({ contractVersionId: versionId, policyId });

      expect(result.violationsCount).toBe(1);
      expect(result.findingsCount).toBe(1);
      expect(result.score).toBe(90); // 100 - 10
      expect(result.status).toBe("COMPLIANT"); // 90 >= 80
      expect(vi.mocked(clauseFindingRepo.upsertClauseFinding)).toHaveBeenCalledWith(
        versionId,
        "rule-1",
        expect.objectContaining({
          complianceStatus: "VIOLATION",
          recommendation: "Clause required by policy is missing or not detected.",
        })
      );
    });
  });

  describe("score calculation", () => {
    it("starts at 100 and subtracts weight per VIOLATION", async () => {
      vi.mocked(policyRuleRepo.findManyPolicyRulesByPolicyId).mockResolvedValue([
        makeRule({ id: "r1", ruleType: "REQUIRED", weight: 5 }),
        makeRule({ id: "r2", ruleType: "REQUIRED", weight: 10 }),
      ]);

      const result = await analyze({ contractVersionId: versionId, policyId });

      expect(result.score).toBe(85); // 100 - 5 - 10
      expect(result.violationsCount).toBe(2);
      expect(result.status).toBe("COMPLIANT");
    });

    it("caps score at 40 when any VIOLATION is CRITICAL", async () => {
      vi.mocked(policyRuleRepo.findManyPolicyRulesByPolicyId).mockResolvedValue([
        makeRule({ id: "r1", ruleType: "REQUIRED", weight: 3, severity: "CRITICAL" }),
        makeRule({ id: "r2", ruleType: "REQUIRED", weight: 5 }),
      ]);

      const result = await analyze({ contractVersionId: versionId, policyId });

      expect(result.score).toBe(40); // cap applied (92 would be > 40)
      expect(result.status).toBe("NON_COMPLIANT");
    });

    it("same input produces same output (deterministic)", async () => {
      vi.mocked(policyRuleRepo.findManyPolicyRulesByPolicyId).mockResolvedValue([
        makeRule({ id: "r1", ruleType: "REQUIRED", weight: 7 }),
      ]);

      const first = await analyze({ contractVersionId: versionId, policyId });
      const second = await analyze({ contractVersionId: versionId, policyId });

      expect(first.score).toBe(second.score);
      expect(first.status).toBe(second.status);
      expect(first.violationsCount).toBe(second.violationsCount);
    });
  });

  describe("policy with no rules", () => {
    it("returns score 100 and no findings", async () => {
      vi.mocked(policyRuleRepo.findManyPolicyRulesByPolicyId).mockResolvedValue([]);
      vi.mocked(clauseFindingRepo.upsertClauseFinding).mockClear();

      const result = await analyze({ contractVersionId: versionId, policyId });

      expect(result.score).toBe(100);
      expect(result.status).toBe("COMPLIANT");
      expect(result.findingsCount).toBe(0);
      expect(result.violationsCount).toBe(0);
      expect(vi.mocked(clauseFindingRepo.upsertClauseFinding)).not.toHaveBeenCalled();
      expect(vi.mocked(contractComplianceRepo.upsertContractCompliance)).toHaveBeenCalledWith(
        versionId,
        policyId,
        { score: 100, status: "COMPLIANT" }
      );
    });
  });

  describe("non-REQUIRED rules", () => {
    it("marks FORBIDDEN as NOT_APPLICABLE (no deduction)", async () => {
      vi.mocked(policyRuleRepo.findManyPolicyRulesByPolicyId).mockResolvedValue([
        makeRule({ id: "r1", ruleType: "FORBIDDEN", weight: 5 }),
      ]);

      const result = await analyze({ contractVersionId: versionId, policyId });

      expect(result.score).toBe(100);
      expect(result.violationsCount).toBe(0);
      expect(vi.mocked(clauseFindingRepo.upsertClauseFinding)).toHaveBeenCalledWith(
        versionId,
        "r1",
        expect.objectContaining({ complianceStatus: "NOT_APPLICABLE" })
      );
    });
  });

  describe("policy not found", () => {
    it("throws", async () => {
      vi.mocked(policyRepo.findPolicyById).mockResolvedValue(null);

      await expect(analyze({ contractVersionId: versionId, policyId })).rejects.toThrow(
        "Policy not found"
      );
    });
  });
});
