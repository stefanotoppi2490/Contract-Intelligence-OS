/**
 * STEP 10: Dashboard repository — workspace contracts with latest version risk posture.
 * No N+1: batch fetch contracts (with latest version), compliances, findings, exceptions.
 */

import { prisma } from "../prisma";
import type { Prisma } from "@prisma/client";
import * as policyRepo from "./policyRepo";
import { computeDashboardRowAggregation } from "@/core/services/dashboard/dashboardAggregation";
import type { ComplianceStatusType } from "@prisma/client";
import type { RiskType } from "@prisma/client";

export type DashboardContractRow = {
  contractId: string;
  contractTitle: string;
  counterpartyId: string;
  counterpartyName: string;
  versionId: string;
  versionNumber: number;
  effectiveScore: number;
  status: ComplianceStatusType;
  violationCount: number;
  unclearCount: number;
  overriddenCount: number;
  riskTypeBreakdown: Record<string, { violations: number; unclear: number }>;
  exceptionsRequested: number;
  exceptionsApproved: number;
  lastAnalyzedAt: string | null;
};

export type DashboardFilters = {
  policyId?: string;
  status?: ComplianceStatusType;
  riskType?: RiskType;
  counterpartyId?: string;
  hasOpenExceptions?: boolean;
  hasUnclear?: boolean;
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: "title" | "score" | "lastAnalyzed" | "counterparty";
  sortOrder?: "asc" | "desc";
};

export type DashboardResult = {
  rows: DashboardContractRow[];
  total: number;
  page: number;
  pageSize: number;
  policyId: string;
  policyName: string;
};

export async function getDashboardContractRows(
  workspaceId: string,
  filters: DashboardFilters = {}
): Promise<DashboardResult> {
  const firstPolicies = await policyRepo.findManyPoliciesByWorkspace(workspaceId, { take: 1 });
  const policyId = filters.policyId ?? firstPolicies[0]?.id;
  if (!policyId) {
    return {
      rows: [],
      total: 0,
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 20,
      policyId: "",
      policyName: firstPolicies[0]?.name ?? "",
    };
  }

  const policy = await policyRepo.findPolicyByWorkspaceAndId(workspaceId, policyId);
  if (!policy) {
    return {
      rows: [],
      total: 0,
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 20,
      policyId,
      policyName: "",
    };
  }

  const where: Prisma.ContractWhereInput = { workspaceId };
  if (filters.counterpartyId) where.counterpartyId = filters.counterpartyId;
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { counterparty: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const contracts = await prisma.contract.findMany({
    where,
    include: {
      counterparty: true,
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  const versionIds = contracts
    .map((c) => c.versions[0]?.id)
    .filter((id): id is string => id != null);

  if (versionIds.length === 0) {
    return {
      rows: [],
      total: 0,
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 20,
      policyId,
      policyName: policy.name,
    };
  }

  const [compliances, allFindings, exceptionRequests] = await Promise.all([
    prisma.contractCompliance.findMany({
      where: { contractVersionId: { in: versionIds }, policyId },
      include: { contractVersion: { select: { id: true } } },
    }),
    prisma.clauseFinding.findMany({
      where: { contractVersionId: { in: versionIds } },
      include: { rule: { select: { policyId: true, weight: true } } },
    }),
    prisma.exceptionRequest.findMany({
      where: {
        contractVersionId: { in: versionIds },
        policyId,
        status: { in: ["REQUESTED", "APPROVED"] },
      },
      select: { contractVersionId: true, status: true, clauseFindingId: true },
    }),
  ]);

  const complianceByVersionId = new Map(compliances.map((c) => [c.contractVersionId, c]));
  const findingsByVersionId = new Map<string, typeof allFindings>();
  for (const f of allFindings) {
    if (!findingsByVersionId.has(f.contractVersionId))
      findingsByVersionId.set(f.contractVersionId, []);
    findingsByVersionId.get(f.contractVersionId)!.push(f);
  }
  const approvedByVersionId = new Map<string, { clauseFindingId: string | null }[]>();
  const requestedByVersionId = new Map<string, number>();
  for (const e of exceptionRequests) {
    if (e.status === "APPROVED") {
      const list = approvedByVersionId.get(e.contractVersionId) ?? [];
      list.push({ clauseFindingId: e.clauseFindingId });
      approvedByVersionId.set(e.contractVersionId, list);
    } else {
      requestedByVersionId.set(e.contractVersionId, (requestedByVersionId.get(e.contractVersionId) ?? 0) + 1);
    }
  }

  const rows: DashboardContractRow[] = [];
  for (const contract of contracts) {
    const version = contract.versions[0];
    if (!version) continue;

    const compliance = complianceByVersionId.get(version.id);
    const policyFindings = (findingsByVersionId.get(version.id) ?? []).filter(
      (f) => (f.rule as { policyId?: string })?.policyId === policyId
    );
    const approved = approvedByVersionId.get(version.id) ?? [];

    if (!compliance) continue;

    const agg = computeDashboardRowAggregation(compliance, policyFindings, approved);

    if (filters.status && agg.status !== filters.status) continue;
    if (filters.hasUnclear === true && agg.unclearCount === 0) continue;
    if (filters.hasUnclear === false && agg.unclearCount > 0) continue;
    const openCount = requestedByVersionId.get(version.id) ?? 0;
    if (filters.hasOpenExceptions === true && openCount === 0) continue;
    if (filters.hasOpenExceptions === false && openCount > 0) continue;
    if (filters.riskType) {
      const rt = agg.riskTypeBreakdown[filters.riskType];
      if (!rt || (rt.violations === 0 && rt.unclear === 0)) continue;
    }

    rows.push({
      contractId: contract.id,
      contractTitle: contract.title,
      counterpartyId: contract.counterpartyId,
      counterpartyName: contract.counterparty.name,
      versionId: version.id,
      versionNumber: version.versionNumber,
      effectiveScore: agg.effectiveScore,
      status: agg.status,
      violationCount: agg.violationCount,
      unclearCount: agg.unclearCount,
      overriddenCount: agg.overriddenCount,
      riskTypeBreakdown: agg.riskTypeBreakdown,
      exceptionsRequested: openCount,
      exceptionsApproved: approved.length,
      lastAnalyzedAt: compliance.createdAt.toISOString(),
    });
  }

  const sortKey = filters.sort ?? "title";
  const order = filters.sortOrder ?? "asc";
  rows.sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "title":
        cmp = a.contractTitle.localeCompare(b.contractTitle);
        break;
      case "counterparty":
        cmp = a.counterpartyName.localeCompare(b.counterpartyName);
        break;
      case "score":
        cmp = a.effectiveScore - b.effectiveScore;
        break;
      case "lastAnalyzed":
        cmp =
          (a.lastAnalyzedAt ?? "").localeCompare(b.lastAnalyzedAt ?? "");
        break;
      default:
        cmp = 0;
    }
    return order === "desc" ? -cmp : cmp;
  });

  const total = rows.length;
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const start = (page - 1) * pageSize;
  const paginatedRows = rows.slice(start, start + pageSize);

  return {
    rows: paginatedRows,
    total,
    page,
    pageSize,
    policyId,
    policyName: policy.name,
  };
}
