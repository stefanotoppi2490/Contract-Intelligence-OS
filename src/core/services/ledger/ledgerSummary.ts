/**
 * Deterministic human-readable summary for LedgerEvent. No AI.
 */

import type { LedgerEventType } from "@prisma/client";

export type LedgerEventForSummary = {
  type: LedgerEventType;
  entityType: string;
  entityId: string;
  contractId?: string | null;
  policyId?: string | null;
  exceptionId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type LedgerSummaryContext = {
  contractTitleById?: Record<string, string>;
  policyNameById?: Record<string, string>;
  exceptionTitleById?: Record<string, string>;
  exceptionClauseTypeById?: Record<string, string>;
  actorNameById?: Record<string, string>;
};

function meta(event: LedgerEventForSummary): Record<string, unknown> {
  return event.metadata && typeof event.metadata === "object" ? event.metadata : {};
}

function get<T>(m: Record<string, T> | undefined, id: string | null | undefined): T | undefined {
  if (!id || !m) return undefined;
  return m[id];
}

export function formatLedgerSummary(
  event: LedgerEventForSummary,
  ctx?: LedgerSummaryContext | null
): string {
  const m = meta(event);
  const contractTitle = get(ctx?.contractTitleById ?? {}, event.contractId);
  const policyName = get(ctx?.policyNameById ?? {}, event.policyId);
  const exceptionTitle = get(ctx?.exceptionTitleById ?? {}, event.exceptionId) ?? (m.title as string | undefined);
  const exceptionClauseType = get(ctx?.exceptionClauseTypeById ?? {}, event.exceptionId) ?? (m.clauseType as string | undefined);

  switch (event.type) {
    case "CONTRACT_UPLOADED": {
      const fileName = (m.fileName ?? m.originalName) as string | undefined;
      return `Contract uploaded: ${contractTitle ?? event.entityId} (${fileName ?? "file"})`;
    }
    case "TEXT_EXTRACTED": {
      const extractor = (m.extractor as string) ?? "unknown";
      const status = (m.status as string) ?? "";
      return `Text extracted (${extractor}) — ${status}`;
    }
    case "ANALYSIS_RUN": {
      const rawScore = m.rawScore != null ? String(m.rawScore) : "?";
      const effectiveScore = m.effectiveScore != null ? String(m.effectiveScore) : rawScore;
      return `Analysis run: ${policyName ?? event.policyId ?? "?"} — score ${rawScore} → ${effectiveScore}`;
    }
    case "EXCEPTION_REQUESTED":
      return `Exception requested: ${exceptionTitle ?? "—"} (${exceptionClauseType ?? "—"})`;
    case "EXCEPTION_APPROVED":
      return `Exception approved: ${exceptionTitle ?? "—"} (${exceptionClauseType ?? "—"})`;
    case "EXCEPTION_REJECTED":
      return `Exception rejected: ${exceptionTitle ?? "—"} (${exceptionClauseType ?? "—"})`;
    case "EXCEPTION_WITHDRAWN":
      return `Exception withdrawn: ${exceptionTitle ?? "—"} (${exceptionClauseType ?? "—"})`;
    case "POLICY_CREATED":
      return `Policy created: ${policyName ?? (m.name as string) ?? event.entityId}`;
    case "POLICY_RULE_CREATED": {
      const clauseType = (m.clauseType as string) ?? "";
      const ruleType = (m.ruleType as string) ?? "";
      const weight = m.weight != null ? String(m.weight) : "?";
      return `Policy rule created: ${clauseType} ${ruleType} (weight ${weight})`;
    }
    case "POLICY_RULE_UPDATED": {
      const clauseType = (m.clauseType as string) ?? "";
      const ruleType = (m.ruleType as string) ?? "";
      return `Policy rule updated: ${clauseType} ${ruleType}`;
    }
    case "POLICY_RULE_DELETED": {
      const clauseType = (m.clauseType as string) ?? "";
      const ruleType = (m.ruleType as string) ?? "";
      return `Policy rule deleted: ${clauseType} ${ruleType}`;
    }
    case "VERSION_COMPARED" as LedgerEventType:
      return `Version compared: ${policyName ?? event.policyId ?? "?"} (v${m.fromVersionNumber ?? "?"} → v${m.toVersionNumber ?? "?"})`;
    case "REPORT_EXPORTED" as LedgerEventType: {
      const reportType = m.reportType as string | undefined;
      if (reportType === "EXECUTIVE_SUMMARY") {
        const score = (m.effectiveScore as number) ?? "?";
        return `Executive summary exported: ${policyName ?? event.policyId ?? "?"} (score ${score})`;
      }
      return `Report exported: ${policyName ?? event.policyId ?? "?"} (v${m.fromVersionNumber ?? "?"} → v${m.toVersionNumber ?? "?"})`;
    }
    case "DEAL_DECISION_DRAFTED" as LedgerEventType: {
      const outcome = (m.outcome as string) ?? "?";
      const score = (m.effectiveScore as number) ?? "?";
      return `Deal decision drafted: ${policyName ?? event.policyId ?? "?"} — ${outcome} (score ${score})`;
    }
    case "DEAL_DECISION_FINALIZED" as LedgerEventType: {
      const outcome = (m.outcome as string) ?? "?";
      const score = (m.effectiveScore as number) ?? "?";
      return `Deal decision finalized: ${policyName ?? event.policyId ?? "?"} — ${outcome} (score ${score})`;
    }
    case "DEAL_DESK_REPORT_EXPORTED" as LedgerEventType: {
      const outcome = (m.outcome as string) ?? "?";
      const format = (m.format as string) ?? "?";
      return `Deal desk report exported: ${policyName ?? event.policyId ?? "?"} — ${outcome} (${format})`;
    }
    default:
      return `${event.type} — ${event.entityType} ${event.entityId}`;
  }
}
