PROJECT_CONTEXT.md

Contract Intelligence OS — Project Context (Updated to STEP 11)

Vision

Contract Intelligence OS is a policy-driven, audit-ready contract risk decision platform.

The system does not rely on AI for decision-making. Instead, it combines:
• deterministic policy evaluation
• structured risk aggregation
• human-readable AI-generated explanations (optional, controlled)

The goal is to enable Legal, Risk, Procurement and Executive teams to:
• understand contract risk instantly
• compare versions objectively
• approve or reject deals with a clear audit trail

⸻

Core Design Principles 1. Determinism first
• Scores, compliance, decisions are always reproducible
• Same inputs → same outputs 2. AI is assistive, never authoritative
• AI extracts data and generates narratives
• AI never decides compliance, score, or approval 3. Policy-defined truth
• Risk is evaluated only against explicit company policies
• Policies are editable, versionable, and auditable 4. Enterprise auditability
• Every action is logged (Ledger)
• Decisions are traceable to rules, findings, and users

⸻

High-Level Architecture

Document Upload
→ Text Extraction (PDF/DOCX/TXT)
→ ClauseExtraction (AI, neutral, evidence-based)
→ Policy Engine (deterministic)
→ ClauseFindings
→ ContractCompliance (rawScore / effectiveScore)
→ Exceptions (override logic)
→ Risk Aggregation
→ Decision & Reporting

⸻

Data Model (Key Concepts)

Contract

Represents a legal agreement with a counterparty.
• Has multiple versions

ContractVersion

Immutable snapshot of a contract at a given time.
• One main document
• Extracted text
• ClauseExtractions (AI)
• ClauseFindings (policy evaluation)
• Compliance results

ClauseExtraction (AI layer)

Neutral AI output:
• clauseType
• extractedValue (JSON)
• extractedText (quote)
• confidence (0–1)

No compliance logic here.

Policy & PolicyRule

Defines the company standard.
Rules include:
• clauseType
• ruleType (REQUIRED, FORBIDDEN, MIN_VALUE, etc.)
• expectedValue
• severity, riskType, weight

ClauseFinding

Result of evaluating a PolicyRule against ClauseExtraction.
• complianceStatus: COMPLIANT | VIOLATION | UNCLEAR | NOT_APPLICABLE
• foundValue / foundText / confidence
• unclearReason (e.g. LOW_CONFIDENCE)

ContractCompliance

Aggregated result per (version, policy):
• rawScore
• effectiveScore (exceptions applied)
• counts: violations, unclear, overridden

Exceptions

Formal override workflow:
• requested → approved / rejected / withdrawn
• linked to findings
• affects effectiveScore

Ledger

Immutable audit log for:
• uploads
• analysis
• exceptions
• decisions
• reports

⸻

Implemented Feature Steps

STEP 1–4: Foundations
• Auth, workspace scoping, RBAC
• Contract + version management
• Real file upload (Vercel Blob)
• Text extraction (PDF/DOCX/TXT)

STEP 5: Deterministic Policy Engine
• Clause taxonomy
• Rule evaluation
• Scoring logic

STEP 6: Exceptions & Ledger
• Request / approve / reject exceptions
• Full audit trail

STEP 7: Version Compare (Redline + Risk Delta)
• Version A vs B comparison
• Risk improved / worsened
• Exportable report

STEP 8A–8C: AI-Assisted Extraction + Confidence Handling
• AI extracts structured clause data
• Confidence stored and surfaced
• Low confidence → UNCLEAR (deterministic)

STEP 9A–9C: Risk Aggregation & Executive Summary
• Cluster risks by category
• Deterministic compliance summary
• AI-generated narrative (verbalization only)
• Management-ready export

STEP 10: Portfolio Risk Dashboard
• Workspace-level overview
• Latest version per contract
• Filters by riskType, status, exceptions
• C-level visibility

STEP 11: Deal Desk Mode (Premium)
• Single-contract decision view
• Compliance + findings + exceptions + narrative
• Deterministic recommendation: GO / NO_GO / NEEDS_REVIEW
• Draft / Final decision
• Export decision report

⸻

Scoring & Decision Logic (Invariant)
• VIOLATION deducts weight
• UNCLEAR does not deduct (but triggers NEEDS_REVIEW)
• APPROVED exceptions remove deduction

Decision:
• effectiveScore < 60 → NO_GO
• violations > 0 or unclear > 0 → NEEDS_REVIEW
• else → GO

⸻

Role of AI in the System

AI is used only for:
• ClauseExtraction (structured, quoted, confidence-based)
• Narrative generation (executive summaries, reports)

AI is never used for:
• compliance
• scoring
• approval decisions

⸻

Product Positioning

Contract Intelligence OS is not a contract reader.

It is a:
• Risk Decision Engine
• Policy Enforcement Layer
• Deal Desk Infrastructure

Designed for:
• Legal & Risk teams
• Procurement
• Executives
• Auditors

⸻

Future Extensions (Optional)
• Policy packs (industry-specific)
• Negotiation clause suggestions (assistive)
• SSO / SCIM
• External API / Webhooks
• Multi-policy portfolio analysis

⸻

Non-Goals
• No black-box AI decisions
• No heuristic scoring
• No untraceable outputs

⸻

This document is the source of truth for architecture, behavior, and product philosophy.
