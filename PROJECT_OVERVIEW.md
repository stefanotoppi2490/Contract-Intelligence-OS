Perfetto. Ti lascio un recap completo + una roadmap a step “da manuale”, così Cursor lavora per feature senza perdersi e senza fare roba “demo”.
Questa è la base da tenere come checklist per tutto il progetto.

⸻

1. Visione del prodotto

Contract Intelligence OS = piattaforma che:
• importa contratti (versionati)
• usa AI (Gemini 3.5) solo per estrazione/mapping/valori/evidenze
• applica Policy Engine deterministico (standard aziendale)
• genera Violations solo se policy violate
• gestisce Exceptions workflow (request/approve/reject) con override
• mantiene Risk Ledger e Audit log append-only
• produce report e dashboard trend

⸻

2. Oggetti / moduli principali

Domain modules (stabili, core) 1. Workspaces & RBAC 2. Contracts & Versions 3. Documents storage 4. AI Extraction (Gemini) 5. Clause Library + Policy Engine 6. Violations & Compliance Score 7. Exceptions + Approvals 8. Risk Ledger 9. Audit Log 10. Integrations (fase 2: DocuSign, HubSpot/Salesforce, Drive/OneDrive, Slack/Teams) 11. Reporting & Export

⸻

3. Data model (entità che devono esistere)

Tenant & Auth
• Workspace
• User
• Membership (role per workspace)

Business entities
• Counterparty (cliente/fornitore)
• Contract
• ContractVersion
• Document (file metadata, source, storage pointer)

AI & analysis artifacts
• ClauseFinding (per version): clauseType, text, confidence, extractedValues (json), evidence anchors
• Policy (workspace-scoped): ruleType, expected json, severity, allowedException, approverRole, riskType, etc.
• PolicyViolation (per version): found vs expected, severity, action, evidence

Workflow & logs
• ExceptionRequest (+ decision fields)
• RiskLedgerEvent (append-only stream)
• AuditEvent (append-only stream)

Nota: PolicyViolation e ClauseFinding devono essere legati a ContractVersion, non al Contract, così i risultati sono versionati.

⸻

4. Flussi fondamentali (che devono funzionare end-to-end)

4.1 Upload contratto → Crea Version
• utente crea Contract + carica Document
• crea ContractVersion (v1)
• associa document alla version

4.2 Analyze

Pipeline: 1. leggi testo (OCR se serve) 2. Gemini extraction → ClauseFindings (JSON validato) 3. policy evaluation deterministico → Violations 4. compute score deterministico 5. persisti Findings + Violations + Score 6. scrivi RiskLedgerEvent + AuditEvent

4.3 Request Exception
• da una violation (policy.allowException = true)
• crea ExceptionRequest (PENDING) con justification

4.4 Approve/Reject Exception
• solo ruolo autorizzato
• se APPROVED:
• crea override attivo per quella version/policy
• ricalcola violazioni/score
• registra RiskLedgerEvent
• se REJECTED:
• chiude la richiesta
• ledger + audit

⸻

5. Cosa è deterministico vs AI

✅ Deterministico:
• policy rules
• violations
• severity/action (derive dalla policy)
• score e spiegazione

🤖 AI (Gemini 3.5) solo:
• mapping clauseType
• extraction valori (es. days=5, law=IT)
• evidenze (anchorText / offsets)
• analysis text “supportivo” (MA deve citare policy quando presente)

Regola d’oro: se non c’è policy → status UNPOLICED (non “risky”).

⸻

6. Roadmap a step (ordinata e “Cursor-friendly”)

Ogni step deve finire con: DB migration + API + UI minima + test.

⸻

STEP 0 — Repo foundation (1 volta)

Obiettivo: progetto solido, DX, convenzioni.
• Next.js app router + TS strict
• Tailwind + shadcn/ui
• ESLint + Prettier
• env schema (Zod)
• prisma setup + postgres (local)
• base layout UI (shell) + routing
• .cursorrules (già fatto)

Deliverable:
• progetto avviabile + build OK + deploy Vercel OK

⸻

STEP 1 — Auth + Workspace + RBAC (tenant model)
• Auth (NextAuth o Clerk)
• Workspace CRUD (minimo: create + select current workspace)
• Membership con ruoli (Admin/Legal/Risk/Member/Viewer)
• middleware/guard server-side per workspace
• AuditEvent base (login, create workspace)

UI:
• onboarding: crea workspace
• selector workspace
• pagina “Members” minimale

⸻

STEP 2 — Contracts v1 (CRUD + versioning + counterparty)
• Counterparty CRUD
• Contract CRUD (workspace-scoped)
• ContractVersion create (v1/v2…)
• Document metadata model (senza storage avanzato ancora)

UI:
• Contracts list
• Contract detail (versions list)
• Create contract + select counterparty + upload doc

⸻

STEP 3 — Document ingestion (testo + OCR)
• storage: Vercel Blob (consigliato) o S3 compatibile
• upload server route → salva pointer
• text extraction:
• PDF text layer: parse
• OCR fallback (anche semplice in MVP)
• salva documentText per version (o in DocumentText table)

UI:
• preview testo (readonly)
• stato ingestion (UPLOADED / TEXT_READY / ERROR)

⸻

STEP 4 — Clause Types + Policy Library (Admin)
• definisci enums ClauseType/ContractType
• policy CRUD (workspace-scoped)
• policy validation (ruleType -> expected schema)
• seed policies base (12 regole MVP)

UI:
• Policies list
• Create/Edit policy form
• policy preview “expected” + severity + allowedException

⸻

STEP 5 — Policy Engine deterministico (core)
• evaluator per THRESHOLD/BOOLEAN/WHITELIST/CONDITIONAL
• compliance status: COMPLIANT/NON_COMPLIANT/UNPOLICED/REQUIRES_HUMAN_REVIEW
• scoring deterministico + explanation

Test:
• unit test evaluator
• unit test scoring

⸻

STEP 6 — Gemini extraction (solo structured)
• gemini client + retry + timeout + logging
• prompt con:
• contractType
• clause types attesi
• output JSON schema (Zod)
• evidence anchors
• salva ClauseFindings su DB

IMPORTANT:
• AI NON decide severity, solo extractedValues + mapping.

⸻

STEP 7 — Analyze endpoint end-to-end
• POST /contracts/:id/analyze
• pipeline completa:
• load text
• gemini extraction
• policy evaluation
• persist findings/violations/score
• ledger/audit

UI:
• “Analyze” button per version
• results view:
• clause list con Found vs Expected + PolicyId
• violations tab
• score + breakdown

⸻

STEP 8 — Exceptions workflow (request/approve/reject)
• ExceptionRequest create from a violation
• Approve/Reject endpoints (RBAC)
• override logic + recompute score
• ledger events per request/decision

UI:
• “Request Exception” modal
• Exceptions inbox (per approver)
• audit trail per exception

⸻

STEP 9 — Risk Ledger + dashboards (minimo)
• ledger feed append-only
• counterparty risk overview
• renewals alerts (basic)

UI:
• Ledger page
• Counterparty page (risk trend, exceptions count)

⸻

STEP 10 — Integrations (fase 2)

Una per volta: 1. DocuSign (signed status) 2. HubSpot/Salesforce (writeback score) 3. Drive/OneDrive import 4. Slack/Teams notifications 5. SSO

⸻

7. Definition of Done per ogni feature

Una feature è “finita” solo se:
• DB schema + migration
• repository methods
• API route con Zod validation
• RBAC applicato
• UI minima funzionante
• test per la logica critica
• audit/ledger event scritto (se impatta rischio/workflow)
