/**
 * Deterministic version compare: diff findings and risk delta. No AI.
 */

import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as contractComplianceRepo from "@/core/db/repositories/contractComplianceRepo";
import * as clauseFindingRepo from "@/core/db/repositories/clauseFindingRepo";
import * as exceptionRepo from "@/core/db/repositories/exceptionRepo";

export type CompareInput = {
  workspaceId: string;
  contractId: string;
  fromVersionId: string;
  toVersionId: string;
  policyId: string;
};

export type FindingSnapshot = {
  status: string;
  overridden: boolean;
  foundValue?: unknown;
  foundText?: string | null;
  confidence?: number | null;
};

export type ChangeItem = {
  key: string;
  clauseType: string;
  ruleId?: string;
  severity: string | null;
  riskType: string | null;
  weight: number;
  changeType: "ADDED" | "REMOVED" | "MODIFIED" | "UNCHANGED";
  from?: FindingSnapshot;
  to?: FindingSnapshot;
  recommendation?: string | null;
  why?: string;
};

export type TopDriver = {
  clauseType: string;
  key: string;
  deltaImpact: number;
  reason: string;
};

export type VersionCompareResult = {
  from: {
    versionId: string;
    versionNumber: number;
    rawScore: number;
    effectiveScore: number;
  };
  to: {
    versionId: string;
    versionNumber: number;
    rawScore: number;
    effectiveScore: number;
  };
  delta: {
    raw: number;
    effective: number;
    label: "IMPROVED" | "WORSENED" | "UNCHANGED";
  };
  changes: ChangeItem[];
  topDrivers: TopDriver[];
};

function stableJson(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return String(value);
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = obj[k];
  return JSON.stringify(out);
}

function findingKey(f: { ruleId: string; clauseType: string }): string {
  return f.ruleId || f.clauseType;
}

function buildWhy(
  changeType: string,
  from?: FindingSnapshot,
  to?: FindingSnapshot,
  foundValueFrom?: unknown,
  foundValueTo?: unknown
): string {
  if (changeType === "ADDED") {
    const status = to?.status ?? "—";
    return `Clause added in v2: ${status}`;
  }
  if (changeType === "REMOVED") {
    const status = from?.status ?? "—";
    return `Clause removed in v2 (was: ${status})`;
  }
  if (changeType === "MODIFIED") {
    const parts: string[] = [];
    if (from?.status !== to?.status) {
      parts.push(`Compliance changed: ${from?.status ?? "—"} → ${to?.status ?? "—"}`);
      if (to?.status === "UNCLEAR") {
        parts.push("Confidence below threshold (0.75)");
      } else if (from?.status === "UNCLEAR" && to?.status !== "UNCLEAR") {
        parts.push("Confidence now above threshold (0.75)");
      }
    }
    if (from?.overridden !== to?.overridden) {
      if (to?.overridden) parts.push("Approved exception applied in v2");
      else parts.push("Override no longer applied in v2");
    }
    const vFrom = stableJson(foundValueFrom ?? from?.foundValue);
    const vTo = stableJson(foundValueTo ?? to?.foundValue);
    if (vFrom && vTo && vFrom !== vTo) {
      parts.push(`Value changed: ${vFrom.slice(0, 50)}${vFrom.length > 50 ? "…" : ""} → ${vTo.slice(0, 50)}${vTo.length > 50 ? "…" : ""}`);
    }
    return parts.length ? parts.join(". ") : "Content or status changed";
  }
  return "Unchanged";
}

export async function compareVersions(input: CompareInput): Promise<{
  ok: true;
  result: VersionCompareResult;
} | { ok: false; code: "MISSING_ANALYSIS"; missingVersionId: string }> {
  const { workspaceId, contractId, fromVersionId, toVersionId, policyId } = input;

  const contract = await contractRepo.getContractDetail(contractId, workspaceId);
  if (!contract) throw new Error("Contract not found");

  const fromVersion = contract.versions.find((v) => v.id === fromVersionId);
  const toVersion = contract.versions.find((v) => v.id === toVersionId);
  if (!fromVersion || !toVersion) throw new Error("Version not found");

  const [complianceFrom, complianceTo, findingsFrom, findingsTo, approvedFrom, approvedTo] = await Promise.all([
    contractComplianceRepo.findContractComplianceByVersionAndPolicy(fromVersionId, policyId),
    contractComplianceRepo.findContractComplianceByVersionAndPolicy(toVersionId, policyId),
    clauseFindingRepo.findManyClauseFindingsByContractVersion(fromVersionId),
    clauseFindingRepo.findManyClauseFindingsByContractVersion(toVersionId),
    exceptionRepo.findApprovedExceptionsByContractVersion(fromVersionId),
    exceptionRepo.findApprovedExceptionsByContractVersion(toVersionId),
  ]);

  if (!complianceFrom) {
    return { ok: false, code: "MISSING_ANALYSIS", missingVersionId: fromVersionId };
  }
  if (!complianceTo) {
    return { ok: false, code: "MISSING_ANALYSIS", missingVersionId: toVersionId };
  }

  const policyIdFilter = (f: { rule: { policyId?: string } }) => (f.rule as { policyId?: string })?.policyId === policyId;
  const fromFindings = findingsFrom.filter(policyIdFilter);
  const toFindings = findingsTo.filter(policyIdFilter);

  const overriddenFrom = new Set<string>();
  for (const ex of approvedFrom) {
    if (ex.clauseFindingId) overriddenFrom.add(ex.clauseFindingId);
  }
  const overriddenTo = new Set<string>();
  for (const ex of approvedTo) {
    if (ex.clauseFindingId) overriddenTo.add(ex.clauseFindingId);
  }

  let effectiveScoreFrom = complianceFrom.score;
  let effectiveScoreTo = complianceTo.score;
  for (const f of fromFindings) {
    const policyIdRule = (f.rule as { policyId?: string })?.policyId;
    if (policyIdRule !== policyId) continue;
    if (f.complianceStatus !== "VIOLATION" && f.complianceStatus !== "UNCLEAR") continue;
    if (!overriddenFrom.has(f.id)) continue;
    const weight = (f.rule as { weight?: number })?.weight ?? 1;
    effectiveScoreFrom = Math.min(100, effectiveScoreFrom + weight);
  }
  for (const f of toFindings) {
    const policyIdRule = (f.rule as { policyId?: string })?.policyId;
    if (policyIdRule !== policyId) continue;
    if (f.complianceStatus !== "VIOLATION" && f.complianceStatus !== "UNCLEAR") continue;
    if (!overriddenTo.has(f.id)) continue;
    const weight = (f.rule as { weight?: number })?.weight ?? 1;
    effectiveScoreTo = Math.min(100, effectiveScoreTo + weight);
  }

  const fromByKey = new Map<string, typeof fromFindings[0]>();
  for (const f of fromFindings) fromByKey.set(findingKey(f), f);
  const toByKey = new Map<string, typeof toFindings[0]>();
  for (const f of toFindings) toByKey.set(findingKey(f), f);

  const allKeys = new Set([...fromByKey.keys(), ...toByKey.keys()]);
  const changes: ChangeItem[] = [];
  const driverCandidates: { key: string; clauseType: string; weight: number; impactFrom: number; impactTo: number }[] = [];

  for (const key of allKeys) {
    const fromF = fromByKey.get(key);
    const toF = toByKey.get(key);
    const weight = (fromF?.rule ?? toF?.rule) as { weight?: number } | undefined;
    const w = weight?.weight ?? 1;
    const severity = fromF?.severity ?? toF?.severity ?? null;
    const riskType = fromF?.riskType ?? toF?.riskType ?? null;
    const clauseType = fromF?.clauseType ?? toF?.clauseType ?? "OTHER";
    const ruleId = fromF?.ruleId ?? toF?.ruleId;

    const isViolationFrom = fromF && fromF.complianceStatus === "VIOLATION";
    const isOverriddenFrom = fromF ? overriddenFrom.has(fromF.id) : false;
    const isViolationTo = toF && toF.complianceStatus === "VIOLATION";
    const isOverriddenTo = toF ? overriddenTo.has(toF.id) : false;

    const impactFrom = isViolationFrom && !isOverriddenFrom ? w : 0;
    const impactTo = isViolationTo && !isOverriddenTo ? w : 0;
    driverCandidates.push({ key, clauseType, weight: w, impactFrom, impactTo });

    const snapFrom: FindingSnapshot | undefined = fromF
      ? {
          status: fromF.complianceStatus,
          overridden: isOverriddenFrom,
          foundValue: fromF.foundValue ?? undefined,
          foundText: fromF.foundText ?? null,
          confidence: fromF.confidence ?? null,
        }
      : undefined;
    const snapTo: FindingSnapshot | undefined = toF
      ? {
          status: toF.complianceStatus,
          overridden: isOverriddenTo,
          foundValue: toF.foundValue ?? undefined,
          foundText: toF.foundText ?? null,
          confidence: toF.confidence ?? null,
        }
      : undefined;

    let changeType: ChangeItem["changeType"] = "UNCHANGED";
    if (!fromF && toF) changeType = "ADDED";
    else if (fromF && !toF) changeType = "REMOVED";
    else if (fromF && toF) {
      const statusChanged = fromF.complianceStatus !== toF.complianceStatus;
      const overriddenChanged = isOverriddenFrom !== isOverriddenTo;
      const valueChanged = stableJson(fromF.foundValue) !== stableJson(toF.foundValue);
      const textChanged = (fromF.foundText ?? "") !== (toF.foundText ?? "");
      if (statusChanged || overriddenChanged || valueChanged || textChanged) changeType = "MODIFIED";
    }

    const why = buildWhy(changeType, snapFrom, snapTo, fromF?.foundValue, toF?.foundValue);
    const recommendation = (fromF?.recommendation ?? toF?.recommendation) ?? null;

    changes.push({
      key,
      clauseType,
      ruleId,
      severity,
      riskType,
      weight: w,
      changeType,
      from: snapFrom,
      to: snapTo,
      recommendation,
      why,
    });
  }

  const topDrivers: TopDriver[] = driverCandidates
    .map((d) => ({
      ...d,
      deltaImpact: d.impactFrom - d.impactTo,
    }))
    .filter((d) => d.deltaImpact !== 0)
    .sort((a, b) => Math.abs(b.deltaImpact) - Math.abs(a.deltaImpact))
    .slice(0, 5)
    .map((d) => ({
      clauseType: d.clauseType,
      key: d.key,
      deltaImpact: d.deltaImpact,
      reason: d.deltaImpact > 0 ? "Improved" : "Worsened",
    }));

  const rawDelta = complianceTo.score - complianceFrom.score;
  const effectiveDelta = effectiveScoreTo - effectiveScoreFrom;
  const label: VersionCompareResult["delta"]["label"] =
    effectiveDelta > 0 ? "IMPROVED" : effectiveDelta < 0 ? "WORSENED" : "UNCHANGED";

  const fromVersionNum = fromVersion.versionNumber;
  const toVersionNum = toVersion.versionNumber;

  return {
    ok: true,
    result: {
      from: {
        versionId: fromVersionId,
        versionNumber: fromVersionNum,
        rawScore: complianceFrom.score,
        effectiveScore: effectiveScoreFrom,
      },
      to: {
        versionId: toVersionId,
        versionNumber: toVersionNum,
        rawScore: complianceTo.score,
        effectiveScore: effectiveScoreTo,
      },
      delta: { raw: rawDelta, effective: effectiveDelta, label },
      changes,
      topDrivers,
    },
  };
}
