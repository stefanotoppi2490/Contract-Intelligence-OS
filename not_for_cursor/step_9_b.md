Implement STEP 9B: AI-assisted Executive Risk Narrative (presentation layer only).

Context
• STEP 9A complete: deterministic Executive Risk Summary exists.
• Risk aggregation is already computed deterministically:
• score (raw / effective)
• violationCount
• unclearCount
• risk clusters per RiskType (LEGAL, FINANCIAL, DATA, etc.)
• key risks list (top drivers)
• ClauseExtraction and Policy Engine must NOT be changed.
• All calculations, scores, and risk levels remain 100% deterministic.
• We want to use AI only to phrase a human-readable executive narrative.
• Output must be management-ready, not legal analysis.

⸻

Goal

Add an AI-generated executive narrative that:
• explains the risk situation in natural language
• is based only on structured deterministic input
• does NOT influence score, compliance, or decisions
• is safe, reproducible, and auditable
• is optional (can be regenerated without side effects)

This narrative is presentation only.

⸻

Core Rule (VERY IMPORTANT)

AI never sees raw contract text.
AI never sees extracted clauses.
AI never decides compliance or risk.

AI receives only structured summary data.

⸻

1️⃣ Data fed to AI (STRICT INPUT)

Create a DTO used as the only AI input:

type ExecutiveNarrativeInput = {
contractTitle: string
policyName: string
score: number
status: "COMPLIANT" | "NEEDS_REVIEW" | "NON_COMPLIANT"

violationCount: number
unclearCount: number

riskSummary: Array<{
riskType: "LEGAL" | "FINANCIAL" | "DATA" | "OPERATIONAL" | "SECURITY"
level: "OK" | "MEDIUM" | "NEEDS_REVIEW"
violations: number
unclear: number
}>

keyRisks: string[] // already human-readable, deterministic
}

No other data is allowed.

⸻

2️⃣ AI Service

Create:

src/core/services/reports/executiveNarrativeAI.ts

Function:

generateExecutiveNarrative(
input: ExecutiveNarrativeInput
): Promise<string>

Responsibilities:
• produce 1 short paragraph (3–5 sentences max)
• business / executive tone
• no legal advice
• no suggestions outside provided data

⸻

3️⃣ AI Prompt (internal, fixed)

Use this exact prompt structure:

You are generating an executive-level risk summary for a business audience.

Use ONLY the structured data provided.
Do NOT invent facts.
Do NOT add legal advice.
Do NOT mention missing clauses or raw contract text.

The goal is to explain:
• overall risk posture
• why the contract requires or does not require review
• which risk areas are most relevant

Keep the tone professional, neutral, and concise.

Then pass the structured JSON input.

⸻

4️⃣ Deterministic Guardrails

Before calling AI:
• If violationCount === 0 and unclearCount === 0
• You MAY skip AI and show a static sentence:
“This contract does not present material risks under the selected policy.”
• If AI fails:
• fallback to deterministic executive sentence from STEP 9A

AI output is never persisted as source of truth.

⸻

5️⃣ API

Add endpoint:

POST /api/contracts/:id/executive-narrative

Body:

{ "policyId": "..." }

Behavior:
• computes ExecutiveNarrativeInput deterministically
• calls AI
• returns { narrative: string }

RBAC:
• VIEWER: read-only allowed
• LEGAL / RISK / ADMIN: allowed

⸻

6️⃣ UI

In Executive Risk Summary panel:
• Add section:
“Executive Narrative (AI-generated)”
• Show paragraph text
• Add small label:
“Generated from structured risk data”
• Optional button:
“Regenerate narrative” (same input, no side effects)

⸻

7️⃣ Ledger (optional, lightweight)

Do NOT add new enum.

Optionally attach to existing event:
• type: ANALYSIS_RUN
• metadata:

{
"executiveNarrativeGenerated": true
}

⸻

8️⃣ Tests
• AI is never called with raw text
• Same input → deterministic structure (content may vary linguistically)
• Narrative exists even if AI fails (fallback works)
• No score/compliance changes after generation

⸻

9️⃣ Manual Verification Checklist 1. Analyze a contract with violations. 2. Open Executive Risk Summary. 3. See:
• deterministic summary (STEP 9A)
• AI narrative below it 4. Narrative:
• matches score and risks
• mentions key areas (LEGAL / FINANCIAL / DATA)
• does NOT mention clauses, pages, or contract text 5. Regenerate narrative → no data changes.

⸻

Deliverables
• executiveNarrativeAI.ts
• API endpoint
• UI integration
• guardrails + fallback
• tests

⸻

Important reminder

This step adds zero risk to the system.
It improves:
• readability
• sales
• executive adoption

without touching:
• policy logic
• scoring
• compliance
• auditability

⸻
