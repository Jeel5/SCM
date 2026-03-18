# Security Disposition (Batch 1)

Date: 2026-03-18  
Source: `Jeel5-SCM-analysis-report(1).json`

Scope of this batch:
- `results.sast` (9)
- `results.secrets` (1)
- `results.infrastructure` (4)
- Cross-check against `results.sast_false_positives` (5)

Status values:
- `FIX_NOW`: low-risk patch should be applied in next micro-batch
- `ACCEPT_WITH_NOTE`: acceptable for now, document rationale and monitor
- `REVIEW_POLICY`: requires your policy decision first

## 1) SAST findings (9)

1. `demo/carrier-portal.js:121` (`innerHTML`-style XSS pattern)
- Status: `ACCEPTED_OUT_OF_SCOPE_2026-03-18`
- Reason: `demo/` excluded from strict project remediation scope.

2. `demo/carrier-portal.js:244` (`innerHTML`-style XSS pattern)
- Status: `ACCEPTED_OUT_OF_SCOPE_2026-03-18`
- Reason: `demo/` excluded from strict project remediation scope.

3. `demo/carrier-portal.js:418` (`innerHTML`-style XSS pattern)
- Status: `ACCEPTED_OUT_OF_SCOPE_2026-03-18`
- Reason: `demo/` excluded from strict project remediation scope.

4. `demo/carrier-portal.js:495` (`innerHTML`-style XSS pattern)
- Status: `ACCEPTED_OUT_OF_SCOPE_2026-03-18`
- Reason: `demo/` excluded from strict project remediation scope.

5. `demo/carrier-portal.js:590` (`innerHTML`-style XSS pattern)
- Status: `ACCEPTED_OUT_OF_SCOPE_2026-03-18`
- Reason: `demo/` excluded from strict project remediation scope.

6. `demo/carrier-portal.js:604` (`innerHTML`-style XSS pattern)
- Status: `ACCEPTED_OUT_OF_SCOPE_2026-03-18`
- Reason: `demo/` excluded from strict project remediation scope.

7. `demo/customer.html:7` (missing SRI integrity attribute)
- Status: `FIXED_2026-03-18`
- Reason: easy hardening with no behavior change if CDN script hash is pinned.

8. `demo/customer.html:9` (missing SRI integrity attribute)
- Status: `FIXED_2026-03-18`
- Reason: easy hardening with no behavior change if CDN stylesheet hash is pinned.

9. `demo/customer.js:170` (`innerHTML`-style XSS pattern)
- Status: `ACCEPTED_OUT_OF_SCOPE_2026-03-18`
- Reason: report has related false-positive note and `demo/` is excluded from strict project scope.

## 2) SAST false-positive cross-check (5)

1. `backend/services/emailService.js:38`
- Status: `ACCEPT_WITH_NOTE`
- Reason: scanner itself includes clear false-positive reasoning; current encoding is explicit and purposeful.

2. `backend/utils/cryptoUtils.js:88`
- Status: `HARDENED_2026-03-18`
- Reason: scanner itself includes false-positive reasoning; additionally hardened by setting explicit `authTagLength` in decrypt options.

3. `demo/carrier-portal.js:133`
4. `demo/carrier-portal.js:487`
5. `demo/customer.js:201`
- Status: `ACCEPTED_OUT_OF_SCOPE_2026-03-18`
- Reason: demo-only XSS-like patterns and `demo/` is excluded from strict project scope.

## 3) Secrets findings (1)

1. `demo/customer.js:2` (`Hex High Entropy String`, confidence MEDIUM)
- Status: `FIXED_2026-03-18`
- Reason: hardcoded token-like value should not be committed as literal.
- Applied patch: replaced literal token with `REPLACE_WITH_DEMO_WEBHOOK_TOKEN` placeholder.

## 4) Infrastructure findings (4)

1. `/frontend/Dockerfile`: missing `HEALTHCHECK`
- Status: `FIXED_2026-03-18`
- Reason: simple non-breaking hardening.

2. `/frontend/Dockerfile`: no non-root `USER`
- Status: `REVIEW_POLICY`
- Reason: current image/runtime listens on port 80; moving to non-root requires coordinated port/config updates.

3. `/backend/Dockerfile`: missing `HEALTHCHECK`
- Status: `FIXED_2026-03-18`
- Reason: simple baseline improvement.

4. `/backend/Dockerfile`: no non-root `USER`
- Status: `FIXED_2026-03-18`
- Reason: standard container hardening baseline.

## 5) Proposed micro-batch execution order

Micro-batch 1:
- `demo/customer.js` hardcoded token remediation.

Micro-batch 2:
- Add `HEALTHCHECK` + non-root user in `backend/Dockerfile` (completed).

Micro-batch 3:
- Add `HEALTHCHECK` in `frontend/Dockerfile` (completed); non-root user remains policy-scoped follow-up.

Micro-batch 4:
- Decide demo policy (`REVIEW_POLICY` items), then either remediate all demo XSS-like patterns or scope them out of strict gate.

## 6) Decisions needed from you

1. For `/frontend/Dockerfile` non-root runtime: apply coordinated port/runtime change now or defer?
