Contract Intelligence OS — PROJECT_CONTEXT

Questo documento è la fonte di verità del progetto Contract Intelligence OS.
Serve a fornire a strumenti agentic (Cursor, ChatGPT, ecc.) contesto completo, coerente e non ambiguo su architettura, principi, step già completati e direzione futura.

⸻

1. Visione del prodotto

Contract Intelligence OS è una piattaforma deterministica, auditabile e enterprise-grade per:
• analisi contrattuale
• valutazione di compliance e rischio
• gestione eccezioni
• confronto versioni (redline + risk delta)

Principio cardine:

L’AI fornisce solo evidenza (estrazione). Le decisioni sono sempre deterministiche.

⸻

2. Principi non negoziabili
   • ❌ Nessuna decisione demandata all’AI
   • ✅ Policy Engine sempre deterministico
   • ✅ Output riproducibili a parità di input
   • ✅ Audit trail completo (Ledger append-only)
   • ✅ Workspace-scoped + RBAC ovunque
   • ✅ Nessuna logica “magica” o nascosta

⸻

3. Stack tecnico
   • Frontend / Backend: Next.js App Router (TypeScript strict)
   • ORM: Prisma
   • DB: PostgreSQL
   • Auth: NextAuth / Auth.js
   • AI: Gemini 3.5 (solo per estrazione, mai per scoring)
   • PDF: @react-pdf/renderer
   • UI: shadcn/ui
   • Deploy: Vercel

⸻

4. Modelli concettuali chiave

4.1 ClauseExtraction (STEP 8A)

Rappresenta ciò che il contratto dice, non un giudizio.
• clauseType
• extractedValue (JSON)
• extractedText (citazione letterale)
• confidence (0..1)
• sourceLocation (opzionale)

È neutrale, evidence-based, AI-generated.

⸻

4.2 ClauseFinding (STEP 5B → 8B → 8C)

Rappresenta la valutazione deterministica di una policy rule.
• complianceStatus: COMPLIANT | VIOLATION | UNCLEAR | NOT_APPLICABLE
• foundValue / foundText / confidence (copiati dall’extraction)
• severity, riskType, weight
• unclearReason (LOW_CONFIDENCE, …)

ClauseFinding non è output AI.

⸻

4.3 Policy Engine
• Input: ClauseExtraction + PolicyRules
• Output: ClauseFindings + ContractCompliance
• Nessuna chiamata AI
• Deterministico al 100%

⸻

5. Pipeline di analisi (stato attuale)

Upload documento
↓
Text extraction (PDF/DOCX/TXT)
↓
AI Clause Extraction (STEP 8A)
↓
Policy Engine (STEP 8B)
↓
Confidence gate → UNCLEAR (STEP 8C)
↓
ClauseFindings + Compliance

⸻

6. STEP completati

STEP 1–4
• Core DB + Auth + RBAC
• Contratti, versioni, upload reali
• Text extraction pipeline

STEP 5A / 5B
• Policy Engine deterministico
• PolicyRules configurabili

STEP 6
• Exceptions + Ledger (audit completo)

STEP 7
• Compare versions (redline + risk delta)
• Top drivers
• Export HTML + PDF

STEP 8A
• AI-assisted ClauseExtraction (neutrale)

STEP 8B
• Policy Engine consuma ClauseExtraction
• Fallback controllato se extraction mancante

STEP 8C
• Uso confidence per:
• marcare UNCLEAR
• NON penalizzare score
• forzare NEEDS_REVIEW

⸻

7. Regole chiave di STEP 8C
   • confidence < 0.75 → complianceStatus = UNCLEAR
   • UNCLEAR:
   • ❌ non sottrae peso
   • ✅ visibile in UI
   • ✅ influenza stato complessivo (NEEDS_REVIEW)
   • confidence null/undefined → 0.0

⸻

8. UX expected (STEP 8C)

Contract detail
• Badge UNCLEAR (giallo)
• Testo: “Low extraction confidence (62%), needs review”
• Pulsante “Request exception” disponibile

Compliance header
• Score raw / effective
• “⚠ X clauses need review” se unclearCount > 0

Compare (STEP 7)
• UNCLEAR ↔ COMPLIANT = MODIFIED
• Why deterministico basato su confidence threshold

⸻

9. Ledger
   • Tutto append-only
   • Eventi umanizzati via formatter deterministico
   • Nessuna AI nel ledger

⸻

10. Direzione futura

STEP 9 (prossimo)

Risk aggregation & reporting:
• cluster di rischio per categoria
• executive summary deterministica
• export management-ready

STEP 10+
• Workspace-level policy profiles
• Benchmarking
• Risk trends nel tempo

⸻

11. Regola d’oro per Cursor / AI

Se una modifica introduce non-determinismo, AI decisionale o rompe l’audit → È SBAGLIATA.

Questo file va letto prima di generare codice o suggerire refactor.
