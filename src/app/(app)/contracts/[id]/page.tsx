import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace } from "@/core/services/security/rbac";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as policyRepo from "@/core/db/repositories/policyRepo";
import { ContractDetailClient } from "./ContractDetailClient";

export const dynamic = "force-dynamic";

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSessionWithWorkspace();
  try {
    requireWorkspace(session);
  } catch {
    redirect("/select-workspace");
  }
  const workspaceId = session.currentWorkspaceId!;
  const { id } = await params;
  const [contract, policies] = await Promise.all([
    contractRepo.getContractDetail(id, workspaceId),
    policyRepo.findManyPoliciesByWorkspace(workspaceId),
  ]);
  if (!contract) notFound();
  const TEXT_PREVIEW_LEN = 500;
  const payload = {
    id: contract.id,
    title: contract.title,
    status: contract.status,
    contractType: contract.contractType,
    counterpartyId: contract.counterpartyId,
    counterpartyName: contract.counterparty.name,
    startDate: contract.startDate?.toISOString() ?? null,
    endDate: contract.endDate?.toISOString() ?? null,
    versions: contract.versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      documents: v.documents.map((d) => ({
        id: d.id,
        originalName: d.originalName,
        mimeType: d.mimeType,
        size: d.size,
        storageKey: d.storageKey,
        ingestionStatus: d.ingestionStatus ?? null,
        lastError: d.lastError ?? null,
      })),
      versionText: v.versionText
        ? {
            status: v.versionText.status,
            preview: v.versionText.text.slice(0, TEXT_PREVIEW_LEN),
            extractedAt: v.versionText.extractedAt.toISOString(),
            errorMessage: v.versionText.errorMessage ?? null,
            extractor: v.versionText.extractor,
          }
        : null,
      compliances: (() => {
        const approvedByFindingId = new Map<string, { id: string }>();
        for (const ex of v.exceptionRequests) {
          if (ex.clauseFindingId && ex.status === "APPROVED") approvedByFindingId.set(ex.clauseFindingId, { id: ex.id });
        }
        const ruleWeightByFindingId = new Map<string, number>();
        for (const f of v.clauseFindings) {
          const weight = (f.rule as { weight?: number })?.weight ?? 1;
          ruleWeightByFindingId.set(f.id, weight);
        }
        return v.contractCompliance.map((c) => {
          let effectiveScore = c.score;
          let violationCount = 0;
          let unclearCount = 0;
          let compliantCount = 0;
          for (const f of v.clauseFindings) {
            const policyId = (f.rule as { policyId?: string })?.policyId;
            if (policyId !== c.policyId) continue;
            if (f.complianceStatus === "VIOLATION") violationCount += 1;
            else if (f.complianceStatus === "UNCLEAR") unclearCount += 1;
            else if (f.complianceStatus === "COMPLIANT") compliantCount += 1;
            if (f.complianceStatus !== "VIOLATION" && f.complianceStatus !== "UNCLEAR") continue;
            if (!approvedByFindingId.has(f.id)) continue;
            const weight = ruleWeightByFindingId.get(f.id) ?? 1;
            effectiveScore = Math.min(100, effectiveScore + weight);
          }
          const needsReview = unclearCount > 0 || violationCount > 0;
          const status =
            effectiveScore < 60
              ? "NON_COMPLIANT"
              : violationCount > 0
                ? "NEEDS_REVIEW"
                : unclearCount > 0
                  ? "NEEDS_REVIEW"
                  : "COMPLIANT";
          return {
            policyId: c.policyId,
            policyName: c.policy.name,
            score: c.score,
            effectiveScore,
            status,
            unclearCount,
            violationCount,
            compliantCount,
            needsReview,
          };
        });
      })(),
      findings: (() => {
        const findingToException = new Map<string, { id: string; status: string }>();
        for (const ex of v.exceptionRequests) {
          if (ex.clauseFindingId) findingToException.set(ex.clauseFindingId, { id: ex.id, status: ex.status });
        }
        return v.clauseFindings.map((f) => {
          const ex = findingToException.get(f.id);
          const isOverridden = ex?.status === "APPROVED" && (f.complianceStatus === "VIOLATION" || f.complianceStatus === "UNCLEAR");
          return {
            id: f.id,
            clauseType: f.clauseType,
            ruleId: f.ruleId,
            complianceStatus: f.complianceStatus,
            severity: f.severity,
            riskType: f.riskType,
            recommendation: f.recommendation,
            foundText: f.foundText ?? null,
            foundValue: f.foundValue ?? null,
            confidence: f.confidence ?? null,
            parseNotes: f.parseNotes ?? null,
            expectedValue: f.rule?.expectedValue ?? null,
            exceptionId: ex?.id ?? null,
            exceptionStatus: ex?.status ?? null,
            isOverridden: isOverridden ?? false,
            unclearReason: (f as { unclearReason?: string | null }).unclearReason ?? null,
          };
        });
      })(),
      extractions: (v.clauseExtractions ?? []).map((e) => ({
        id: e.id,
        clauseType: e.clauseType,
        extractedValue: e.extractedValue,
        extractedText: e.extractedText ?? null,
        confidence: e.confidence,
        sourceLocation: e.sourceLocation,
        extractedBy: e.extractedBy,
        createdAt: e.createdAt.toISOString(),
      })),
    })),
  };
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/contracts" className="text-sm text-muted-foreground hover:underline">
          ← Contracts
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{contract.title}</h1>
          {contract.versions.length >= 2 && (
            <Link
              href={`/contracts/${contract.id}/compare`}
              className="text-sm font-medium text-primary hover:underline"
            >
              Compare versions
            </Link>
          )}
        </div>
        <p className="text-muted-foreground">
          {contract.counterparty.name} · {contract.contractType ?? "—"} · {contract.status}
        </p>
      </div>
      <ContractDetailClient
        contractId={contract.id}
        payload={payload}
        policies={policies.map((p) => ({ id: p.id, name: p.name }))}
        canMutate={session.role !== "VIEWER"}
        canAnalyze={["LEGAL", "RISK", "ADMIN"].includes(session.role ?? "")}
      />
    </div>
  );
}
