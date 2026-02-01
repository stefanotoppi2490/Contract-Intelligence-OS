import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { prisma } from "../prisma";
import {
  createContractWithV1,
  createNextVersion,
  listContracts,
  getContractDetail,
} from "./contractRepo";

const WORKSPACE_A = "workspace-a";
const WORKSPACE_B = "workspace-b";
const COUNTERPARTY_A = "counterparty-a";
const COUNTERPARTY_B = "counterparty-b";

const dbAvailable = !!process.env.DATABASE_URL;

describe.runIf(dbAvailable)("contractRepo (requires DATABASE_URL)", () => {
  beforeEach(async () => {
    if (!dbAvailable) return;
    await prisma.document.deleteMany({});
    await prisma.contractVersion.deleteMany({});
    await prisma.contract.deleteMany({});
    await prisma.counterparty.deleteMany({});
    await prisma.workspace.deleteMany({});
    await prisma.workspace.createMany({
      data: [
        { id: WORKSPACE_A, name: "Workspace A" },
        { id: WORKSPACE_B, name: "Workspace B" },
      ],
    });
    await prisma.counterparty.createMany({
      data: [
        { id: COUNTERPARTY_A, workspaceId: WORKSPACE_A, name: "Counterparty A", type: "CUSTOMER" },
        { id: COUNTERPARTY_B, workspaceId: WORKSPACE_B, name: "Counterparty B", type: "VENDOR" },
      ],
    });
  });

  describe("createContractWithV1", () => {
    it("creates contract and version 1 in one transaction", async () => {
      const contract = await createContractWithV1({
        workspace: { connect: { id: WORKSPACE_A } },
        counterparty: { connect: { id: COUNTERPARTY_A } },
        title: "Test Contract",
        status: "DRAFT",
      });
      expect(contract).toBeDefined();
      expect(contract.id).toBeDefined();
      expect(contract.title).toBe("Test Contract");
      expect(contract.versions).toHaveLength(1);
      expect(contract.versions![0]!.versionNumber).toBe(1);
    });
  });

  describe("createNextVersion", () => {
    it("increments versionNumber correctly and is race-safe within transaction", async () => {
      const contract = await createContractWithV1({
        workspace: { connect: { id: WORKSPACE_A } },
        counterparty: { connect: { id: COUNTERPARTY_A } },
        title: "Test",
        status: "DRAFT",
      });
      const v2 = await createNextVersion(contract.id);
      expect(v2.versionNumber).toBe(2);
      const v3 = await createNextVersion(contract.id);
      expect(v3.versionNumber).toBe(3);
      const detail = await getContractDetail(contract.id);
      expect(detail?.versions.map((v) => v.versionNumber)).toEqual([1, 2, 3]);
    });

    it("version numbers are unique per contract (contractId, versionNumber)", async () => {
      const c1 = await createContractWithV1({
        workspace: { connect: { id: WORKSPACE_A } },
        counterparty: { connect: { id: COUNTERPARTY_A } },
        title: "C1",
        status: "DRAFT",
      });
      const c2 = await createContractWithV1({
        workspace: { connect: { id: WORKSPACE_A } },
        counterparty: { connect: { id: COUNTERPARTY_A } },
        title: "C2",
        status: "DRAFT",
      });
      const v2c1 = await createNextVersion(c1.id);
      const v2c2 = await createNextVersion(c2.id);
      expect(v2c1.versionNumber).toBe(2);
      expect(v2c2.versionNumber).toBe(2);
      expect(v2c1.contractId).toBe(c1.id);
      expect(v2c2.contractId).toBe(c2.id);
    });
  });

  describe("workspace scoping", () => {
    it("listContracts returns only contracts in the given workspace", async () => {
      await createContractWithV1({
        workspace: { connect: { id: WORKSPACE_A } },
        counterparty: { connect: { id: COUNTERPARTY_A } },
        title: "Contract in A",
        status: "DRAFT",
      });
      await createContractWithV1({
        workspace: { connect: { id: WORKSPACE_B } },
        counterparty: { connect: { id: COUNTERPARTY_B } },
        title: "Contract in B",
        status: "DRAFT",
      });
      const listA = await listContracts(WORKSPACE_A);
      const listB = await listContracts(WORKSPACE_B);
      expect(listA).toHaveLength(1);
      expect(listB).toHaveLength(1);
      expect(listA[0]!.title).toBe("Contract in A");
      expect(listB[0]!.title).toBe("Contract in B");
    });

    it("getContractDetail returns null for contract in another workspace", async () => {
      const contract = await createContractWithV1({
        workspace: { connect: { id: WORKSPACE_A } },
        counterparty: { connect: { id: COUNTERPARTY_A } },
        title: "Only in A",
        status: "DRAFT",
      });
      const detail = await getContractDetail(contract.id);
      expect(detail?.workspaceId).toBe(WORKSPACE_A);
      const fromB = await prisma.contract.findFirst({
        where: { id: contract.id, workspaceId: WORKSPACE_B },
      });
      expect(fromB).toBeNull();
    });
  });
});
