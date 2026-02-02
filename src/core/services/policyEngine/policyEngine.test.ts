import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { analyze, MissingExtractionsError } from "./policyEngine";

vi.mock("@/core/db/repositories/policyRepo");
vi.mock("@/core/db/repositories/policyRuleRepo");
vi.mock("@/core/db/repositories/clauseFindingRepo");
vi.mock("@/core/db/repositories/contractComplianceRepo");
vi.mock("@/core/db/repositories/contractVersionTextRepo");
vi.mock("@/core/db/repositories/clauseExtractionRepo");
vi.mock("@/core/services/policy/aiClauseExtractor");
vi.mock("@/core/config/confidence", () => ({
  getConfidenceThreshold: vi.fn(() => 0.75),
  clampConfidence: vi.fn((v: number | null | undefined) => {
    if (v == null || Number.isNaN(v)) return 0;
    return Math.max(0, Math.min(1, v));
  }),
}));

import * as policyRepo from "@/core/db/repositories/policyRepo";
import * as policyRuleRepo from "@/core/db/repositories/policyRuleRepo";
import * as clauseFindingRepo from "@/core/db/repositories/clauseFindingRepo";
import * as contractComplianceRepo from "@/core/db/repositories/contractComplianceRepo";
import * as contractVersionTextRepo from "@/core/db/repositories/contractVersionTextRepo";
import * as clauseExtractionRepo from "@/core/db/repositories/clauseExtractionRepo";
import { extractClauses } from "@/core/services/policy/aiClauseExtractor";

const policyId = "policy-1";
const versionId = "version-1";
const contractText = "Sample contract text for analysis.";

function makeRule(overrides: {
  id: string;
  ruleType: "REQUIRED" | "FORBIDDEN" | "MIN_VALUE" | "MAX_VALUE" | "ALLOWED_VALUES";
  weight?: number;
  severity?: string | null;
  clauseType?: string;
  riskType?: string | null;
  recommendation?: string;
  expectedValue?: unknown;
}): Awaited<ReturnType<typeof policyRuleRepo.findManyPolicyRulesByPolicyId>>[number] {
  return {
    id: overrides.id,
    policyId,
    clauseType: (overrides.clauseType ?? "TERMINATION") as Awaited<
      ReturnType<typeof policyRuleRepo.findManyPolicyRulesByPolicyId>
    >[number]["clauseType"],
    ruleType: overrides.ruleType,
    expectedValue: overrides.expectedValue ?? null,
    severity: overrides.severity ?? null,
    riskType: overrides.riskType ?? null,
    weight: overrides.weight ?? 1,
    recommendation:
      overrides.recommendation ??
      "Clause required by policy is missing or not detected.",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Awaited<ReturnType<typeof policyRuleRepo.findManyPolicyRulesByPolicyId>>[number];
}

function extractionResult(overrides: {
  ruleId: string;
  clauseType?: string;
  present?: boolean;
  confidence?: number;
  foundValue?: unknown;
}) {
  return {
    ruleId: overrides.ruleId,
    clauseType: (overrides.clauseType ?? "TERMINATION") as "TERMINATION",
    present: overrides.present ?? false,
    foundText: null,
    foundValue: overrides.foundValue ?? null,
    confidence: overrides.confidence ?? 0,
    notes: null,
  };
}

describe("policyEngine (STEP 5B)", () => {
  beforeAll(() => {
    process.env.USE_CLAUSE_EXTRACTIONS = "false";
  });
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
    vi.mocked(contractVersionTextRepo.findContractVersionTextByVersionId).mockResolvedValue({
      id: "vt-1",
      contractVersionId: versionId,
      text: contractText,
      status: "TEXT_READY",
      extractor: "TXT",
      extractedAt: new Date(),
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Awaited<ReturnType<typeof contractVersionTextRepo.findContractVersionTextByVersionId>>);
    vi.mocked(policyRuleRepo.findManyPolicyRulesByPolicyId).mockResolvedValue([]);
    vi.mocked(extractClauses).mockResolvedValue([]);
    vi.mocked(clauseFindingRepo.upsertClauseFinding).mockResolvedValue({} as never);
    vi.mocked(contractComplianceRepo.upsertContractCompliance).mockResolvedValue({} as never);
  });

  it("throws when contract text not ready", async () => {
    vi.mocked(contractVersionTextRepo.findContractVersionTextByVersionId).mockResolvedValue(null);

    await expect(analyze({ contractVersionId: versionId, policyId })).rejects.toThrow(
      "Contract text not ready"
    );
    expect(vi.mocked(extractClauses)).not.toHaveBeenCalled();
  });

  it("REQUIRED present=true and confidence >= 0.5 => COMPLIANT", async () => {
    vi.mocked(policyRuleRepo.findManyPolicyRulesByPolicyId).mockResolvedValue([
      makeRule({ id: "r1", ruleType: "REQUIRED", weight: 10 }),
    ]);
    vi.mocked(extractClauses).mockResolvedValue([
      extractionResult({ ruleId: "r1", present: true, confidence: 0.8 }),
    ]);

    const result = await analyze({ contractVersionId: versionId, policyId });

    expect(result.violationsCount).toBe(0);
    expect(result.score).toBe(100);
    expect(vi.mocked(clauseFindingRepo.upsertClauseFinding)).toHaveBeenCalledWith(
      versionId,
      "r1",
      expect.objectContaining({
        complianceStatus: "COMPLIANT",
        foundText: null,
        confidence: 0.8,
      })
    );
  });

  it("REQUIRED present=false => VIOLATION", async () => {
    vi.mocked(policyRuleRepo.findManyPolicyRulesByPolicyId).mockResolvedValue([
      makeRule({ id: "r1", ruleType: "REQUIRED", weight: 10 }),
    ]);
    vi.mocked(extractClauses).mockResolvedValue([
      extractionResult({ ruleId: "r1", present: false, confidence: 0 }),
    ]);

    const result = await analyze({ contractVersionId: versionId, policyId });

    expect(result.violationsCount).toBe(1);
    expect(result.score).toBe(90);
    expect(vi.mocked(clauseFindingRepo.upsertClauseFinding)).toHaveBeenCalledWith(
      versionId,
      "r1",
      expect.objectContaining({ complianceStatus: "VIOLATION" })
    );
  });

  it("REQUIRED present=true but confidence < 0.5 => VIOLATION", async () => {
    vi.mocked(policyRuleRepo.findManyPolicyRulesByPolicyId).mockResolvedValue([
      makeRule({ id: "r1", ruleType: "REQUIRED", weight: 5 }),
    ]);
    vi.mocked(extractClauses).mockResolvedValue([
      extractionResult({ ruleId: "r1", present: true, confidence: 0.4 }),
    ]);

    const result = await analyze({ contractVersionId: versionId, policyId });

    expect(result.violationsCount).toBe(1);
    expect(result.score).toBe(95);
  });

  it("MIN_VALUE with foundValue less than expected => VIOLATION", async () => {
    vi.mocked(policyRuleRepo.findManyPolicyRulesByPolicyId).mockResolvedValue([
      makeRule({ id: "r1", ruleType: "MIN_VALUE", weight: 10, expectedValue: 30 }),
    ]);
    vi.mocked(extractClauses).mockResolvedValue([
      extractionResult({ ruleId: "r1", present: true, confidence: 0.8, foundValue: 15 }),
    ]);

    const result = await analyze({ contractVersionId: versionId, policyId });

    expect(result.violationsCount).toBe(1);
    expect(result.score).toBe(90);
    expect(vi.mocked(clauseFindingRepo.upsertClauseFinding)).toHaveBeenCalledWith(
      versionId,
      "r1",
      expect.objectContaining({ complianceStatus: "VIOLATION" })
    );
  });

  it("MIN_VALUE with foundValue null => UNCLEAR", async () => {
    vi.mocked(policyRuleRepo.findManyPolicyRulesByPolicyId).mockResolvedValue([
      makeRule({ id: "r1", ruleType: "MIN_VALUE", weight: 10, expectedValue: 30 }),
    ]);
    vi.mocked(extractClauses).mockResolvedValue([
      extractionResult({ ruleId: "r1", present: true, confidence: 0.8, foundValue: null }),
    ]);

    const result = await analyze({ contractVersionId: versionId, policyId });

    expect(result.violationsCount).toBe(0);
    expect(vi.mocked(clauseFindingRepo.upsertClauseFinding)).toHaveBeenCalledWith(
      versionId,
      "r1",
      expect.objectContaining({ complianceStatus: "UNCLEAR" })
    );
  });

  it("MIN_VALUE with foundValue >= expected => COMPLIANT", async () => {
    vi.mocked(policyRuleRepo.findManyPolicyRulesByPolicyId).mockResolvedValue([
      makeRule({ id: "r1", ruleType: "MIN_VALUE", weight: 10, expectedValue: 30 }),
    ]);
    vi.mocked(extractClauses).mockResolvedValue([
      extractionResult({ ruleId: "r1", present: true, confidence: 0.8, foundValue: 45 }),
    ]);

    const result = await analyze({ contractVersionId: versionId, policyId });

    expect(result.violationsCount).toBe(0);
    expect(result.score).toBe(100);
    expect(vi.mocked(clauseFindingRepo.upsertClauseFinding)).toHaveBeenCalledWith(
      versionId,
      "r1",
      expect.objectContaining({ complianceStatus: "COMPLIANT" })
    );
  });

  it("ALLOWED_VALUES mismatch => VIOLATION", async () => {
    vi.mocked(policyRuleRepo.findManyPolicyRulesByPolicyId).mockResolvedValue([
      makeRule({
        id: "r1",
        ruleType: "ALLOWED_VALUES",
        weight: 10,
        expectedValue: ["IT", "EU"],
      }),
    ]);
    vi.mocked(extractClauses).mockResolvedValue([
      extractionResult({
        ruleId: "r1",
        present: true,
        confidence: 0.9,
        foundValue: "US",
      }),
    ]);

    const result = await analyze({ contractVersionId: versionId, policyId });

    expect(result.violationsCount).toBe(1);
    expect(vi.mocked(clauseFindingRepo.upsertClauseFinding)).toHaveBeenCalledWith(
      versionId,
      "r1",
      expect.objectContaining({ complianceStatus: "VIOLATION" })
    );
  });

  it("policy with no rules returns score 100 and no extraction", async () => {
    vi.mocked(policyRuleRepo.findManyPolicyRulesByPolicyId).mockResolvedValue([]);
    vi.mocked(extractClauses).mockClear();

    const result = await analyze({ contractVersionId: versionId, policyId });

    expect(result.score).toBe(100);
    expect(result.findingsCount).toBe(0);
    expect(vi.mocked(extractClauses)).not.toHaveBeenCalled();
  });

  it("policy not found throws", async () => {
    vi.mocked(policyRepo.findPolicyById).mockResolvedValue(null);

    await expect(analyze({ contractVersionId: versionId, policyId })).rejects.toThrow(
      "Policy not found"
    );
  });

  it("calls extractClauses with contract text and rules", async () => {
    vi.mocked(policyRuleRepo.findManyPolicyRulesByPolicyId).mockResolvedValue([
      makeRule({ id: "r1", ruleType: "REQUIRED" }),
    ]);
    vi.mocked(extractClauses).mockResolvedValue([
      extractionResult({ ruleId: "r1", present: true, confidence: 0.7 }),
    ]);

    await analyze({ contractVersionId: versionId, policyId });

    expect(vi.mocked(extractClauses)).toHaveBeenCalledWith({
      contractText,
      rules: [{ ruleId: "r1", clauseType: "TERMINATION", ruleType: "REQUIRED", expectedValue: null }],
    });
  });
});

describe("policyEngine STEP 8B (ClauseExtraction path)", () => {
  beforeEach(() => {
    process.env.USE_CLAUSE_EXTRACTIONS = "true";
  });
  afterEach(() => {
    delete process.env.USE_CLAUSE_EXTRACTIONS;
  });
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
    vi.mocked(contractVersionTextRepo.findContractVersionTextByVersionId).mockResolvedValue({
      id: "vt-1",
      contractVersionId: versionId,
      text: contractText,
      status: "TEXT_READY",
      extractor: "TXT",
      extractedAt: new Date(),
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Awaited<ReturnType<typeof contractVersionTextRepo.findContractVersionTextByVersionId>>);
    vi.mocked(policyRuleRepo.findManyPolicyRulesByPolicyId).mockResolvedValue([]);
    vi.mocked(clauseExtractionRepo.findManyByContractVersion).mockResolvedValue([]);
    vi.mocked(clauseFindingRepo.upsertClauseFinding).mockResolvedValue({} as never);
    vi.mocked(contractComplianceRepo.upsertContractCompliance).mockResolvedValue({} as never);
  });

  it("throws MissingExtractionsError when no extractions exist", async () => {
    vi.mocked(policyRuleRepo.findManyPolicyRulesByPolicyId).mockResolvedValue([
      makeRule({ id: "r1", ruleType: "REQUIRED" }),
    ]);
    vi.mocked(clauseExtractionRepo.findManyByContractVersion).mockResolvedValue([]);

    await expect(analyze({ contractVersionId: versionId, policyId })).rejects.toThrow(MissingExtractionsError);
    await expect(analyze({ contractVersionId: versionId, policyId })).rejects.toMatchObject({
      code: "MISSING_EXTRACTIONS",
    });
    expect(vi.mocked(clauseExtractionRepo.findManyByContractVersion)).toHaveBeenCalledWith(versionId);
  });

  it("produces ClauseFindings from ClauseExtraction without calling AI", async () => {
    vi.mocked(policyRuleRepo.findManyPolicyRulesByPolicyId).mockResolvedValue([
      makeRule({ id: "r1", ruleType: "REQUIRED", clauseType: "TERMINATION" }),
    ]);
    vi.mocked(clauseExtractionRepo.findManyByContractVersion).mockResolvedValue([
      {
        id: "ex-1",
        workspaceId: "ws-1",
        contractId: "c-1",
        contractVersionId: versionId,
        clauseType: "TERMINATION",
        extractedValue: { noticeDays: 30 },
        extractedText: "Either party may terminate with 30 days notice.",
        confidence: 0.9,
        sourceLocation: null,
        extractedBy: "AI",
        createdAt: new Date(),
      } as Awaited<ReturnType<typeof clauseExtractionRepo.findManyByContractVersion>>[number],
    ]);

    const result = await analyze({ contractVersionId: versionId, policyId });

    expect(result.violationsCount).toBe(0);
    expect(result.score).toBe(100);
    expect(result.mode).toBe("EVALUATE_EXTRACTED_CLAUSES");
    expect(vi.mocked(clauseExtractionRepo.findManyByContractVersion)).toHaveBeenCalledWith(versionId);
    expect(vi.mocked(clauseFindingRepo.upsertClauseFinding)).toHaveBeenCalledWith(
      versionId,
      "r1",
      expect.objectContaining({
        complianceStatus: "COMPLIANT",
        foundText: "Either party may terminate with 30 days notice.",
        foundValue: { noticeDays: 30 },
        confidence: 0.9,
      })
    );
  });

  it("MIN_VALUE uses extractedValue.noticeDays from ClauseExtraction", async () => {
    vi.mocked(policyRuleRepo.findManyPolicyRulesByPolicyId).mockResolvedValue([
      makeRule({ id: "r1", ruleType: "MIN_VALUE", clauseType: "TERMINATION", weight: 10, expectedValue: 30 }),
    ]);
    vi.mocked(clauseExtractionRepo.findManyByContractVersion).mockResolvedValue([
      {
        id: "ex-1",
        workspaceId: "ws-1",
        contractId: "c-1",
        contractVersionId: versionId,
        clauseType: "TERMINATION",
        extractedValue: { noticeDays: 45 },
        extractedText: "45 days notice.",
        confidence: 0.85,
        sourceLocation: null,
        extractedBy: "AI",
        createdAt: new Date(),
      } as Awaited<ReturnType<typeof clauseExtractionRepo.findManyByContractVersion>>[number],
    ]);

    const result = await analyze({ contractVersionId: versionId, policyId });

    expect(result.violationsCount).toBe(0);
    expect(result.score).toBe(100);
    expect(vi.mocked(clauseFindingRepo.upsertClauseFinding)).toHaveBeenCalledWith(
      versionId,
      "r1",
      expect.objectContaining({
        complianceStatus: "COMPLIANT",
        foundValue: { noticeDays: 45 },
        confidence: 0.85,
      })
    );
  });

  it("no extraction for non-REQUIRED rule => NOT_APPLICABLE", async () => {
    vi.mocked(policyRuleRepo.findManyPolicyRulesByPolicyId).mockResolvedValue([
      makeRule({ id: "r1", ruleType: "MIN_VALUE", clauseType: "LIABILITY", expectedValue: 1000000 }),
    ]);
    vi.mocked(clauseExtractionRepo.findManyByContractVersion).mockResolvedValue([
      {
        id: "ex-1",
        workspaceId: "ws-1",
        contractId: "c-1",
        contractVersionId: versionId,
        clauseType: "TERMINATION",
        extractedValue: { noticeDays: 30 },
        extractedText: "30 days.",
        confidence: 0.9,
        sourceLocation: null,
        extractedBy: "AI",
        createdAt: new Date(),
      } as Awaited<ReturnType<typeof clauseExtractionRepo.findManyByContractVersion>>[number],
    ]);

    const result = await analyze({ contractVersionId: versionId, policyId });

    expect(result.violationsCount).toBe(0);
    expect(result.score).toBe(100);
    expect(vi.mocked(clauseFindingRepo.upsertClauseFinding)).toHaveBeenCalledWith(
      versionId,
      "r1",
      expect.objectContaining({ complianceStatus: "NOT_APPLICABLE", foundText: null, confidence: undefined })
    );
  });

  describe("STEP 8C confidence threshold", () => {
    it("extraction with confidence 0.6 and threshold 0.75 => finding UNCLEAR, unclearReason LOW_CONFIDENCE, no deduction", async () => {
      vi.mocked(policyRuleRepo.findManyPolicyRulesByPolicyId).mockResolvedValue([
        makeRule({ id: "r1", ruleType: "REQUIRED", clauseType: "DATA_PRIVACY", weight: 10 }),
      ]);
      vi.mocked(clauseExtractionRepo.findManyByContractVersion).mockResolvedValue([
        {
          id: "ex-1",
          workspaceId: "ws-1",
          contractId: "c-1",
          contractVersionId: versionId,
          clauseType: "DATA_PRIVACY",
          extractedValue: { present: true },
          extractedText: "Data processed per DPA.",
          confidence: 0.6,
          sourceLocation: null,
          extractedBy: "AI",
          createdAt: new Date(),
        } as Awaited<ReturnType<typeof clauseExtractionRepo.findManyByContractVersion>>[number],
      ]);

      const result = await analyze({ contractVersionId: versionId, policyId });

      expect(result.score).toBe(100);
      expect(result.violationsCount).toBe(0);
      expect(result.unclear).toHaveLength(1);
      expect(result.unclear![0]).toEqual({
        clauseType: "DATA_PRIVACY",
        confidence: 0.6,
        threshold: 0.75,
      });
      expect(vi.mocked(clauseFindingRepo.upsertClauseFinding)).toHaveBeenCalledWith(
        versionId,
        "r1",
        expect.objectContaining({
          complianceStatus: "UNCLEAR",
          unclearReason: "LOW_CONFIDENCE",
          confidence: 0.6,
          foundText: "Data processed per DPA.",
        })
      );
    });

    it("extraction with confidence 0.9 => normal evaluation runs", async () => {
      vi.mocked(policyRuleRepo.findManyPolicyRulesByPolicyId).mockResolvedValue([
        makeRule({ id: "r1", ruleType: "REQUIRED", clauseType: "TERMINATION" }),
      ]);
      vi.mocked(clauseExtractionRepo.findManyByContractVersion).mockResolvedValue([
        {
          id: "ex-1",
          workspaceId: "ws-1",
          contractId: "c-1",
          contractVersionId: versionId,
          clauseType: "TERMINATION",
          extractedValue: { noticeDays: 30 },
          extractedText: "30 days notice.",
          confidence: 0.9,
          sourceLocation: null,
          extractedBy: "AI",
          createdAt: new Date(),
        } as Awaited<ReturnType<typeof clauseExtractionRepo.findManyByContractVersion>>[number],
      ]);

      const result = await analyze({ contractVersionId: versionId, policyId });

      expect(result.score).toBe(100);
      expect(result.violationsCount).toBe(0);
      expect(result.unclear).toBeUndefined();
      expect(vi.mocked(clauseFindingRepo.upsertClauseFinding)).toHaveBeenCalledWith(
        versionId,
        "r1",
        expect.objectContaining({
          complianceStatus: "COMPLIANT",
          unclearReason: null,
          confidence: 0.9,
        })
      );
    });

    it("extraction with confidence null => UNCLEAR (clamped to 0)", async () => {
      vi.mocked(policyRuleRepo.findManyPolicyRulesByPolicyId).mockResolvedValue([
        makeRule({ id: "r1", ruleType: "REQUIRED", clauseType: "OTHER" }),
      ]);
      vi.mocked(clauseExtractionRepo.findManyByContractVersion).mockResolvedValue([
        {
          id: "ex-1",
          workspaceId: "ws-1",
          contractId: "c-1",
          contractVersionId: versionId,
          clauseType: "OTHER",
          extractedValue: null,
          extractedText: "Some text.",
          confidence: null as unknown as number,
          sourceLocation: null,
          extractedBy: "AI",
          createdAt: new Date(),
        } as Awaited<ReturnType<typeof clauseExtractionRepo.findManyByContractVersion>>[number],
      ]);

      const result = await analyze({ contractVersionId: versionId, policyId });

      expect(result.score).toBe(100);
      expect(result.unclear).toHaveLength(1);
      expect(vi.mocked(clauseFindingRepo.upsertClauseFinding)).toHaveBeenCalledWith(
        versionId,
        "r1",
        expect.objectContaining({
          complianceStatus: "UNCLEAR",
          unclearReason: "LOW_CONFIDENCE",
        })
      );
    });
  });
});
