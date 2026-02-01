import { NextResponse } from "next/server";
import { getServerSessionWithWorkspace } from "@/core/services/security/auth";
import { requireWorkspace, requireRole, AuthError } from "@/core/services/security/rbac";
import { createContractSchema, listContractsQuerySchema } from "@/lib/validations/contract";
import * as contractRepo from "@/core/db/repositories/contractRepo";
import * as counterpartyRepo from "@/core/db/repositories/counterpartyRepo";
import { createAuditEvent } from "@/core/db/repositories/auditRepo";

export async function GET(req: Request) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireWorkspace(session);
    const workspaceId = session.currentWorkspaceId!;
    const { searchParams } = new URL(req.url);
    const query = listContractsQuerySchema.safeParse({
      status: searchParams.get("status") ?? undefined,
      contractType: searchParams.get("contractType") ?? undefined,
      counterpartyId: searchParams.get("counterpartyId") ?? undefined,
    });
    const filters = query.success ? query.data : undefined;
    const list = await contractRepo.listContracts(workspaceId, filters);
    return NextResponse.json({ contracts: list });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSessionWithWorkspace();
    requireRole(session, { allowedRoles: ["OWNER", "ADMIN", "LEGAL", "RISK", "MEMBER"] });
    const workspaceId = session.currentWorkspaceId!;
    const body = await req.json();
    const parsed = createContractSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { title, contractType, counterpartyId, status, startDate, endDate } = parsed.data;
    const counterparty = await counterpartyRepo.findCounterpartyById(counterpartyId);
    if (!counterparty || counterparty.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Counterparty not found" }, { status: 404 });
    }
    const contract = await contractRepo.createContractWithV1({
      workspace: { connect: { id: workspaceId } },
      counterparty: { connect: { id: counterpartyId } },
      title,
      contractType: contractType ?? undefined,
      status: status ?? "DRAFT",
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
    await createAuditEvent({
      workspace: { connect: { id: workspaceId } },
      eventType: "contract.created",
      actorUserId: session.userId,
      payload: { contractId: contract.id, title, counterpartyId },
    });
    await createAuditEvent({
      workspace: { connect: { id: workspaceId } },
      eventType: "contract_version.created",
      actorUserId: session.userId,
      payload: { contractId: contract.id, versionNumber: 1 },
    });
    return NextResponse.json(contract);
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
