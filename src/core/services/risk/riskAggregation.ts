/**
 * STEP 9A: Risk aggregation types (in-memory, read-only).
 * No Prisma table; computed on the fly from ClauseFinding + ContractCompliance.
 */

export type RiskTypeKey = "LEGAL" | "FINANCIAL" | "OPERATIONAL" | "DATA" | "SECURITY";
export type ClusterLevel = "OK" | "NEEDS_REVIEW" | "MEDIUM" | "HIGH";
export type OverallStatusKey = "COMPLIANT" | "NEEDS_REVIEW" | "NON_COMPLIANT";
export type SeverityKey = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type RiskClusterTopDriver = {
  clauseType: string;
  severity: string | null;
  weight: number;
  reason: string;
};

export type RiskCluster = {
  riskType: RiskTypeKey;
  level: ClusterLevel;
  violationCount: number;
  unclearCount: number;
  overriddenCount: number;
  maxSeverity: SeverityKey | null;
  totalWeight: number;
  topDrivers: RiskClusterTopDriver[];
};

export type RiskAggregation = {
  contractId: string;
  contractVersionId: string;
  policyId: string;
  overallStatus: OverallStatusKey;
  rawScore: number;
  effectiveScore: number;
  clusters: RiskCluster[];
  topDrivers: RiskClusterTopDriver[];
  generatedAt: string;
};
