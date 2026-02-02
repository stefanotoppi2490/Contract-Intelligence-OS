import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace } from "@/core/services/security/rbac";
import * as exceptionRepo from "@/core/db/repositories/exceptionRepo";
import { ExceptionDetailClient } from "./ExceptionDetailClient";

export const dynamic = "force-dynamic";

export default async function ExceptionDetailPage({
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
  const exception = await exceptionRepo.findExceptionRequestByIdAndWorkspace(id, workspaceId);
  if (!exception) notFound();
  const canDecide = ["ADMIN", "LEGAL", "RISK"].includes(session.role ?? "");
  const isRequester = exception.requestedByUserId === session.userId;
  const isAdmin = session.role === "ADMIN" || session.role === "OWNER";
  const canWithdraw = exception.status === "REQUESTED" && (isRequester || isAdmin);
  const payload = {
    id: exception.id,
    contractId: exception.contractId,
    contractVersionId: exception.contractVersionId,
    contractTitle: exception.contractVersion?.contract?.title ?? null,
    versionNumber: exception.contractVersion?.versionNumber ?? null,
    clauseType: exception.clauseType,
    title: exception.title,
    justification: exception.justification,
    requestedByUserId: exception.requestedByUserId,
    status: exception.status,
    decidedByUserId: exception.decidedByUserId,
    decidedAt: exception.decidedAt?.toISOString() ?? null,
    decisionReason: exception.decisionReason,
    createdAt: exception.createdAt.toISOString(),
    finding: exception.clauseFinding
      ? {
          id: exception.clauseFinding.id,
          clauseType: exception.clauseFinding.clauseType,
          complianceStatus: exception.clauseFinding.complianceStatus,
          severity: exception.clauseFinding.severity,
          riskType: exception.clauseFinding.riskType,
          recommendation: exception.clauseFinding.recommendation,
          foundText: exception.clauseFinding.foundText,
          foundValue: exception.clauseFinding.foundValue,
          confidence: exception.clauseFinding.confidence,
          expectedValue: exception.clauseFinding.rule?.expectedValue ?? null,
        }
      : null,
  };
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/exceptions" className="text-sm text-muted-foreground hover:underline">
          ← Exceptions
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{exception.title}</h1>
        <p className="text-muted-foreground">
          Status: {exception.status}
          {exception.contractVersion?.contract?.title && ` · ${exception.contractVersion.contract.title}`}
        </p>
      </div>
      <ExceptionDetailClient
        payload={payload}
        canDecide={canDecide}
        canWithdraw={canWithdraw}
      />
    </div>
  );
}
