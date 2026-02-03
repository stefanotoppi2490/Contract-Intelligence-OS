import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, AuthError } from "@/core/services/security/rbac";
import { getDashboardContractRows } from "@/core/db/repositories/dashboardRepo";
import { z } from "zod";

const querySchema = z.object({
  policyId: z.string().optional(),
  status: z.enum(["COMPLIANT", "NEEDS_REVIEW", "NON_COMPLIANT"]).optional(),
  riskType: z.enum(["LEGAL", "FINANCIAL", "OPERATIONAL", "DATA", "SECURITY"]).optional(),
  counterpartyId: z.string().optional(),
  hasOpenExceptions: z
    .string()
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
  hasUnclear: z
    .string()
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  sort: z.enum(["title", "score", "lastAnalyzed", "counterparty"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

/** GET: dashboard contract rows. Query: policyId, status, riskType, counterpartyId, hasOpenExceptions, hasUnclear, q, page, pageSize, sort, sortOrder. RBAC: VIEWER can read. */
export async function GET(req: Request) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireWorkspace(session);
    const workspaceId = session.currentWorkspaceId!;

    const url = new URL(req.url);
    const parsed = querySchema.safeParse({
      policyId: url.searchParams.get("policyId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      riskType: url.searchParams.get("riskType") ?? undefined,
      counterpartyId: url.searchParams.get("counterpartyId") ?? undefined,
      hasOpenExceptions: url.searchParams.get("hasOpenExceptions") ?? undefined,
      hasUnclear: url.searchParams.get("hasUnclear") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
      sortOrder: url.searchParams.get("sortOrder") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await getDashboardContractRows(workspaceId, parsed.data);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
