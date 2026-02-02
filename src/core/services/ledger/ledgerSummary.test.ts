import { describe, it, expect } from "vitest";
import { formatLedgerSummary } from "./ledgerSummary";
import type { LedgerEventForSummary, LedgerSummaryContext } from "./ledgerSummary";

describe("formatLedgerSummary", () => {
  it("CONTRACT_UPLOADED: uses contract title and fileName from metadata", () => {
    const event: LedgerEventForSummary = {
      type: "CONTRACT_UPLOADED",
      entityType: "Document",
      entityId: "doc-1",
      contractId: "c-1",
      metadata: { fileName: "Consulting Agreement.pdf", mimeType: "application/pdf", size: 1024 },
    };
    const ctx: LedgerSummaryContext = { contractTitleById: { "c-1": "Consulting Agreement" } };
    expect(formatLedgerSummary(event, ctx)).toBe(
      "Contract uploaded: Consulting Agreement (Consulting Agreement.pdf)"
    );
  });

  it("CONTRACT_UPLOADED: fallback when no context", () => {
    const event: LedgerEventForSummary = {
      type: "CONTRACT_UPLOADED",
      entityType: "Document",
      entityId: "doc-1",
      contractId: "c-1",
      metadata: { originalName: "file.pdf" },
    };
    expect(formatLedgerSummary(event, null)).toBe("Contract uploaded: doc-1 (file.pdf)");
  });

  it("ANALYSIS_RUN: uses policy name and rawScore → effectiveScore", () => {
    const event: LedgerEventForSummary = {
      type: "ANALYSIS_RUN",
      entityType: "ContractCompliance",
      entityId: "v-1",
      contractId: "c-1",
      policyId: "p-1",
      metadata: { rawScore: 60, effectiveScore: 75 },
    };
    const ctx: LedgerSummaryContext = { policyNameById: { "p-1": "Default Company Standard" } };
    expect(formatLedgerSummary(event, ctx)).toBe(
      "Analysis run: Default Company Standard — score 60 → 75"
    );
  });

  it("EXCEPTION_APPROVED: uses exception title and clauseType from context", () => {
    const event: LedgerEventForSummary = {
      type: "EXCEPTION_APPROVED",
      entityType: "ExceptionRequest",
      entityId: "ex-1",
      exceptionId: "ex-1",
      metadata: { clauseType: "TERMINATION", decision: "APPROVE" },
    };
    const ctx: LedgerSummaryContext = {
      exceptionTitleById: { "ex-1": "Accept 5-day termination notice" },
      exceptionClauseTypeById: { "ex-1": "TERMINATION" },
    };
    expect(formatLedgerSummary(event, ctx)).toBe(
      "Exception approved: Accept 5-day termination notice (TERMINATION)"
    );
  });

  it("EXCEPTION_WITHDRAWN: uses metadata clauseType when no context", () => {
    const event: LedgerEventForSummary = {
      type: "EXCEPTION_WITHDRAWN",
      entityType: "ExceptionRequest",
      entityId: "ex-1",
      exceptionId: "ex-1",
      metadata: { clauseType: "DATA_PRIVACY" },
    };
    expect(formatLedgerSummary(event, null)).toBe("Exception withdrawn: — (DATA_PRIVACY)");
  });

  it("POLICY_RULE_CREATED: uses metadata clauseType, ruleType, weight", () => {
    const event: LedgerEventForSummary = {
      type: "POLICY_RULE_CREATED",
      entityType: "PolicyRule",
      entityId: "r-1",
      policyId: "p-1",
      metadata: { clauseType: "LIABILITY", ruleType: "REQUIRED", weight: 25 },
    };
    expect(formatLedgerSummary(event, null)).toBe(
      "Policy rule created: LIABILITY REQUIRED (weight 25)"
    );
  });

  it("POLICY_RULE_UPDATED: uses metadata clauseType and ruleType", () => {
    const event: LedgerEventForSummary = {
      type: "POLICY_RULE_UPDATED",
      entityType: "PolicyRule",
      entityId: "r-1",
      policyId: "p-1",
      metadata: { clauseType: "LIABILITY", ruleType: "REQUIRED" },
    };
    expect(formatLedgerSummary(event, null)).toBe("Policy rule updated: LIABILITY REQUIRED");
  });

  it("fallback for unknown type", () => {
    const event = {
      type: "UNKNOWN_TYPE",
      entityType: "Thing",
      entityId: "id-1",
    } as unknown as LedgerEventForSummary;
    expect(formatLedgerSummary(event, null)).toBe("UNKNOWN_TYPE — Thing id-1");
  });
});
