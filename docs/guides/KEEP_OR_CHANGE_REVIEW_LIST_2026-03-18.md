# Keep-Or-Change Review List

Date: 2026-03-18  
Purpose: Items that likely should remain as-is (or are not urgent) unless you explicitly decide otherwise.

Status legend:
- `PROPOSE_KEEP`: likely acceptable for this project right now
- `REVIEW_NEEDED`: needs your product/security decision
- `CHANGE_RECOMMENDED`: likely worth changing soon

## 1) Scanner-marked false positives

1. `backend/services/emailService.js:38`
- Finding: manual HTML escaping warning
- Proposed status: `PROPOSE_KEEP`
- Why: report already explains this is entity-encoding and likely not exploitable in current usage.
- Optional hardening later: use a standard sanitizer for consistency.

2. `backend/utils/cryptoUtils.js:88`
- Finding: GCM auth tag length warning
- Proposed status: `HARDENED_2026-03-18`
- Why: implementation was already likely safe; explicit `authTagLength` was added for cryptographic clarity.

3. `demo/carrier-portal.js:133`
4. `demo/carrier-portal.js:487`
5. `demo/customer.js:201`
- Finding: `innerHTML` anti-pattern entries
- Proposed status: `REVIEW_NEEDED`
- Why: likely non-production demo code and low practical risk per report notes.
- Decision needed from you: should `demo/` be excluded from hard security gate?

## 2) Findings that may not be worth immediate churn

6. Missing docstrings in many UI/test files (for example `frontend/*.tsx`, `backend/tests/*`)
- Proposed status: `PROPOSE_KEEP` (for now)
- Why: adding hundreds of docstrings can create noise without improving safety or runtime behavior.
- Better approach: only document complex services/repositories/flows.

7. Large anti-pattern volume in files recently refactored (for example `backend/jobs/jobHandlers.js` in scanner snapshot)
- Proposed status: `PROPOSE_KEEP` snapshot as historical, then rescan
- Why: report appears generated before latest decomposition work; some findings may already be obsolete.

## 3) Items I recommend changing (not keep)

8. `demo/customer.js:2` secret-like high entropy string
- Proposed status: `FIXED_2026-03-18`
- Why: literal was replaced with `REPLACE_WITH_DEMO_WEBHOOK_TOKEN` placeholder.

9. Container hardening checks (`frontend/Dockerfile` and possibly backend image)
- Proposed status: `PARTIALLY_FIXED_2026-03-18`
- Why: backend now has non-root user + healthcheck, frontend has healthcheck; frontend non-root user requires coordinated port/runtime decision.

## 4) Project policy decisions required from you

10. Scope policy for `demo/`
- Proposed choice A: exclude from strict quality gate, keep only basic lint/security hygiene
- Proposed choice B: treat as production quality and remediate all findings

Decision (2026-03-18): `demo/` is out of project scope and used for simulation/testing only.
Applied policy: exclude `demo/` from strict remediation gate.

11. Docstring policy
- Proposed choice A: enforce only for core backend business logic and shared utilities
- Proposed choice B: enforce everywhere including UI and tests

12. Duplicate-code policy
- Proposed choice A: dedupe only logic-heavy duplicates
- Proposed choice B: dedupe all textual duplicates

## 5) How we will use this file

- At each batch, we update status next to items above.
- Nothing in `PROPOSE_KEEP` is final until you approve.
