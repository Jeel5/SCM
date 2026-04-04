<div align="center">

# TwinChain SCM

*Modern multi-tenant supply chain operations platform built for real-time execution and scale.*

![Last Commit](https://img.shields.io/github/last-commit/Jeel5/SCM?style=flat&color=0A84FF&label=last%20commit)
![Top Language](https://img.shields.io/github/languages/top/Jeel5/SCM?style=flat&color=0A84FF)
![Language Count](https://img.shields.io/github/languages/count/Jeel5/SCM?style=flat&color=0A84FF&label=languages)
![Repo Size](https://img.shields.io/github/repo-size/Jeel5/SCM?style=flat&color=0A84FF)

*Built with the tools and technologies:*

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-149ECA?style=flat&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=flat&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=flat&logo=socketdotio&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)

</div>

## Table of Contents

- [Overview](#overview)
- [Core Capabilities](#core-capabilities)
- [Project Metrics](#project-metrics)
- [Architecture Snapshot](#architecture-snapshot)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Docker Setup (Recommended)](#docker-setup-recommended)
  - [Local Setup](#local-setup)
- [Useful Commands](#useful-commands)
- [Key Endpoints](#key-endpoints)
- [Demo Portals](#demo-portals)
- [Documentation](#documentation)

## Overview

TwinChain SCM is a full-stack, multi-tenant platform for managing order-to-delivery workflows across organizations. It combines operational APIs, real-time events, background processing, and superadmin controls in a single system.

## Core Capabilities

- 🏢 Multi-tenant organization model with role-based access control
- 📦 Orders, shipments, inventory, returns, SLA, and finance modules
- ⚙️ Background jobs and scheduled workflows using BullMQ + Redis
- 🔔 Live operational updates using Socket.IO
- 🔐 Secure webhook and carrier integration flows (JWT + HMAC)
- 🛠️ Superadmin organization lifecycle actions (activate, suspend, restore)

## Project Metrics

| Area | Count |
| --- | ---: |
| 🎛️ Backend controllers | 21 |
| 🛣️ Backend routes | 18 |
| 🧠 Backend services | 32 |
| 🗃️ Backend repositories | 25 |
| 🧱 Backend middlewares | 9 |
| ⏱️ Job modules | 11 |
| 📨 Queue modules | 1 |
| 🗂️ SQL migrations | 18 |
| ✅ Backend test files | 10 |
| 📄 Frontend pages | 135 |
| 🧩 Frontend components | 23 |
| 🪝 Frontend hooks | 5 |
| 🗄️ Frontend store files | 2 |
| 🧪 Demo files | 6 |

## Architecture Snapshot

| Layer | Stack |
| --- | --- |
| Backend API | Node.js + Express 5 (ESM) |
| Frontend | React 19 + TypeScript + Vite |
| Data | PostgreSQL |
| Queue / Scheduling | BullMQ + Redis |
| Realtime | Socket.IO |
| Deployment | Docker Compose + Nginx |

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- Docker + Docker Compose (recommended)

### Docker Setup (Recommended)

1. Copy env files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

2. Create root `.env` for Docker Compose:

```env
DB_NAME=scm_db
DB_USER=postgres
DB_PASSWORD=postgres
VITE_API_URL=http://localhost:3000/api
```

3. Start services:

```bash
docker compose up --build
```

4. Access apps:

- Frontend: http://localhost:5173
- API via Nginx: http://localhost/api
- Health check: http://localhost/health

### Local Setup

1. Install dependencies:

```bash
cd backend && npm install
cd ../frontend && npm install
```

2. Configure env files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

3. Run backend and frontend:

```bash
# Terminal 1
cd backend
npm run dev

# Terminal 2
cd frontend
npm run dev
```

## Useful Commands

### Backend

```bash
npm run dev
npm test
npm start
```

### Frontend

```bash
npm run dev
npm run build
npm run lint
```

## Key Endpoints

- `/api` - API base prefix
- `/health` - service health endpoint
- `/api/organizations` - superadmin org management routes
- `/api/webhooks` - webhook ingress routes

## Demo Portals

- `demo/customer.html`
- `demo/carrier-portal.html`
- `demo/order-tracking.html`

## Documentation

- `docs/README.md`
- `docs/architecture/SYSTEM_OVERVIEW.md`
- `docs/guides/SUPERADMIN_GUIDE.md`

