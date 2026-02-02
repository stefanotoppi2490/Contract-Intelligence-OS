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
      compliances: v.contractCompliance.map((c) => ({
        policyId: c.policyId,
        policyName: c.policy.name,
        score: c.score,
        status: c.status,
      })),
      findings: v.clauseFindings.map((f) => ({
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
      })),
    })),
  };
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/contracts" className="text-sm text-muted-foreground hover:underline">
          ← Contracts
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{contract.title}</h1>
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
