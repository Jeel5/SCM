# TwinChain SCM — Documentation Index

> Last updated: 2026-02-27  
> System version: 2.1.0

---

## 🚀 Where to Start

| Goal | Document |
|---|---|
| Understand the full system | [architecture/SYSTEM_OVERVIEW.md](architecture/SYSTEM_OVERVIEW.md) |
| Run the demo portals | [demo/README.md](demo/README.md) |
| Integrate via webhooks | [webhooks/README_WEBHOOKS.md](webhooks/README_WEBHOOKS.md) |
| Understand carrier assignment | [carrier-integration/CARRIER_PORTAL.md](carrier-integration/CARRIER_PORTAL.md) |
| Backend code patterns | [architecture/CODE_GUIDE.md](architecture/CODE_GUIDE.md) |
| Production checklist | [guides/PRODUCTION_IMPROVEMENTS_CHECKLIST.md](guides/PRODUCTION_IMPROVEMENTS_CHECKLIST.md) |

---

## 📁 Documentation Map

### `/architecture`
| File | Contents |
|---|---|
| **SYSTEM_OVERVIEW.md** | Complete current system — all routes, DB schema, auth, jobs, services |
| **ARCHITECTURE.md** | Backend architecture decisions and patterns |
| **CODE_GUIDE.md** | Code structure, patterns and conventions |
| **QUICK_REFERENCE.md** | Quick reference for common development tasks |
| **PATTERNS.md** | Full pattern library: asyncHandler, repositories, org-context, error classes |
| **ANSWERS.md** | Q&A on architectural decisions and deep-dive explanations |
| **ARCHITECTURE_TASKS.md** | Tracked architecture improvement tasks (R1–R17+) |
| **DATABASE_REVIEW.md** | DB architect review — schema evaluation against industry standards |
| **DOUBTS.md** | Development questions and clarifications |
| **STRUCTURE.md** | Codebase structure and module layout notes |

### `/demo`
| File | Contents |
|---|---|
| **README.md** | Running the demo portals end-to-end (customers, carriers, tracking) |

### `/webhooks`
| File | Contents |
|---|---|
| **README_WEBHOOKS.md** | Multi-tenant webhook system, payload formats, org tokens |
| **WEBHOOK_QUICKSTART.md** | Quick start guide |
| **WEBHOOK_SIMULATION.md** | CLI simulation and testing tools |

### `/carrier-integration`
| File | Contents |
|---|---|
| **CARRIER_PORTAL.md** | Carrier assignment flow, accept/reject, HMAC auth, retry logic |
| **CARRIER_API_INTEGRATION.md** | Integrating real carrier APIs |
| **CARRIER_REAL_WORLD_IMPLEMENTATION.md** | Production carrier implementation |
| **CARRIER_ASSIGNMENT_FLOW_ANALYSIS.md** | Deep-dive on the assignment state machine |
| **CARRIER_FLOW_IMPLEMENTATION_SUMMARY.md** | Implementation summary |

### `/flows`
| File | Contents |
|---|---|
| **SCM_COMPLETE_FLOW.md** | Full business flow from order to delivery |
| **CROMA_EXAMPLE_FLOW.md** | Worked example using Croma as the retailer |
| **TWO_PHASE_CARRIER_QUOTES_COMPLETE_GUIDE.md** | Two-phase shipping quote system |
| **IMPLEMENTATION_SUMMARY.md** | Implementation status overview |

### `/backend`
| File | Contents |
|---|---|
| **TRANSACTION_MANAGEMENT.md** | DB transaction patterns used throughout the codebase |
| **TRANSACTION_ROLLBACK_FIX.md** | How transaction rollback edge cases are handled |

### `/integrations`
| File | Contents |
|---|---|
| **OSRM_INTEGRATION.md** | OSRM routing service for distance-based shipping estimates |

### `/guides`
| File | Contents |
|---|---|
| **SUPERADMIN_GUIDE.md** | Platform superadmin operations |
| **PRODUCTION_IMPROVEMENTS_CHECKLIST.md** | Pre-production readiness checklist |
| **CODEBASE_AUDIT.md** | Live audit of architectural issues, inline TODOs, and production-unsafe features |
| **REMAINING_WORK.md** | Active tracker — what's left to build/fix (Rounds R1–R17+) |
| **PROGRESS_REPORT.md** | Project progress report and system overview |
| **REVIEW_FINDINGS.md** | Per-file review session findings and fix record |
| **FUTURE_WORK.md** | Out-of-scope future improvements (post-MVP, non-blocking) |

---

## 🏗️ Tech Stack Summary

| Layer | Technology |
|---|---|
| Backend | Node.js 20, Express 5, ES Modules |
| Database | PostgreSQL 16 |
| Background Jobs | Custom job worker (polls `background_jobs` table every 5s) |
| Cron Scheduling | Custom cron scheduler (checks `cron_schedules` table every 60s) |
| Auth | JWT (access + refresh tokens), HMAC for carrier webhooks |
| Frontend | React 18, TypeScript, Vite, TanStack Query |
| Demo Portals | Standalone HTML pages in `/demo/` |
| Containerization | Docker Compose (backend, frontend, postgres, redis) |

---

## 📖 Conventions

- Dates: `YYYY-MM-DD`
- Status: ✅ Done | ⚠️ Partial | 🚧 Planned | ❌ Broken / Not implemented
- All API routes are prefixed `/api`
- Webhook routes live under `/api/webhooks`
- Demo-only routes live under `/api/demo` (return 404 in production)
