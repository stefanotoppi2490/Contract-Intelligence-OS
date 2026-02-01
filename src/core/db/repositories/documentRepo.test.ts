import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { prisma } from "../prisma";
import {
  countDocumentsByContractVersion,
  attachDocumentToVersion,
} from "./documentRepo";
import { createContractWithV1 } from "./contractRepo";

const WORKSPACE_A = "workspace-doc-a";
const COUNTERPARTY_A = "counterparty-doc-a";

const dbAvailable = !!process.env.DATABASE_URL;

describe.runIf(dbAvailable)("documentRepo (requires DATABASE_URL)", () => {
  beforeEach(async () => {
    if (!dbAvailable) return;
    await prisma.document.deleteMany({});
    await prisma.contractVersion.deleteMany({});
    await prisma.contract.deleteMany({});
    await prisma.counterparty.deleteMany({});
    await prisma.workspace.deleteMany({});
    await prisma.workspace.createMany({
      data: [{ id: WORKSPACE_A, name: "Workspace Doc A" }],
    });
    await prisma.counterparty.createMany({
      data: [
        {
          id: COUNTERPARTY_A,
          workspaceId: WORKSPACE_A,
          name: "Counterparty Doc A",
          type: "CUSTOMER",
        },
      ],
    });
  });

  describe("countDocumentsByContractVersion and attachDocumentToVersion", () => {
    it("count is 0 for new version, 1 after attach (MVP: one main document per version)", async () => {
      const contract = await createContractWithV1({
        workspace: { connect: { id: WORKSPACE_A } },
        counterparty: { connect: { id: COUNTERPARTY_A } },
        title: "Doc Test",
        status: "DRAFT",
      });
      const versionId = contract.versions![0]!.id;
      const countBefore = await countDocumentsByContractVersion(versionId);
      expect(countBefore).toBe(0);

      await attachDocumentToVersion(versionId, {
        originalName: "test.pdf",
        mimeType: "application/pdf",
        size: 1024,
        storageKey: "pending://x",
        source: "UPLOAD",
      });
      const countAfter = await countDocumentsByContractVersion(versionId);
      expect(countAfter).toBe(1);
    });
  });
});
