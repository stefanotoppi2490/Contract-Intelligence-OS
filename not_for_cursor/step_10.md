Implement STEP 10: Portfolio Risk Dashboard (C-level overview).

Context:
• We have Contracts, Versions, Policies, ClauseFindings, ContractCompliance (raw/effective), Exceptions, Ledger.
• EffectiveScore must consider approved exceptions.
• UI already exists for contract detail, compare, executive summary export.

Goal:
Create a workspace-level dashboard that lists all contracts with their latest risk posture and allows filtering by riskType/status for executive overview.

Requirements: 1. Data aggregation (server-side):

    •	For each contract, pick the latest version (max versionNumber or latest createdAt).
    •	For that version, pick compliance for a selected policy (default: first active policy).
    •	Compute:
    •	effectiveScore, status
    •	counts: violations, unclear, overridden (approved exceptions)
    •	riskType breakdown (LEGAL/FINANCIAL/OPERATIONAL/DATA/SECURITY): counts of violations + unclear
    •	exceptions: requested/open, approved
    •	lastAnalyzedAt (from compliance createdAt or ledger ANALYSIS_RUN)

    2.	API:

    •	GET /api/dashboard/contracts

Query:
• policyId? (optional, default active)
• status? (COMPLIANT|NEEDS_REVIEW|NON_COMPLIANT)
• riskType? (LEGAL|FINANCIAL|OPERATIONAL|DATA|SECURITY)
• counterpartyId?
• hasOpenExceptions? boolean
• hasUnclear? boolean
• q? (search by title/counterparty)
• page, pageSize, sort
RBAC: VIEWER can read.
Workspace-scoped, no N+1 (use Prisma includes/aggregations).

    3.	UI page:

    •	Create /dashboard (or /portfolio) page.
    •	Top controls:
    •	policy dropdown
    •	filters (status, riskType, hasOpenExceptions, hasUnclear)
    •	search input
    •	Table:
    •	Contract title + counterparty
    •	Status badge
    •	EffectiveScore
    •	Violations / Unclear / Overridden counts
    •	Top risk types (chips)
    •	Last analyzed
    •	Link “Open” → /contracts/[id]
    •	Add nav link “Dashboard” in AppLayout.

    4.	Tests:

    •	API returns only workspace contracts.
    •	Filtering by riskType works.
    •	Contract with approved exception shows higher effectiveScore and overridden count.
    •	VIEWER has access.

    5.	Manual verification checklist:

    •	Analyze at least 2 contracts with different outcomes.
    •	Go to /dashboard:
    •	Verify rows match contract detail compliance.
    •	Filters change results.
    •	Clicking opens contract detail.

Deliverables:
• dashboard repo/service (aggregation)
• api route + zod
• ui page
• tests
