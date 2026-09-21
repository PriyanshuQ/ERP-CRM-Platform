# ERP CRM Platform

A multi-tenant ERP and CRM platform built with React, TypeScript, Node.js, Express, PostgreSQL, Supabase, and OpenAI.

## Phase 1

Phase 1 establishes the monorepo foundation:

- `apps/web`: React + TypeScript frontend powered by Vite
- `apps/api`: Node.js + Express + TypeScript API
- Shared environment conventions
- Type-checking, linting, tests, and production builds
- GitHub Actions CI on every push and pull request

## Phase 2

Phase 2 adds the security foundation:

- Supabase Auth client wiring in the web app
- Organization and membership tables
- Application roles and permissions
- PostgreSQL RLS policies for tenant isolation
- A protected `create_organization` database function

The migration is in `supabase/migrations/20260916190000_phase_2_security_foundation.sql`. Review it before applying it to a Supabase project.

Copy `.env.example` to `.env` and provide `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to activate authentication.

## Local development

Requirements: Node.js 20 or newer.

```bash
npm install
cp .env.example .env
npm run dev
```

The web app runs at `http://localhost:5173` and the API runs at `http://localhost:4000`.

Run the full validation suite:

```bash
npm run check
```

## Architecture direction

The project starts as a modular monolith. The API will own business rules and integrations, while Supabase will provide PostgreSQL, Auth, Row-Level Security, and migrations. Organization membership and permissions will be introduced before business modules so tenant isolation is part of the foundation.

## Final MVP phase

The final MVP foundation adds:

- Inventory, warehouses, stock movements, and inventory levels
- Invoices and invoice items
- Customer activities
- AI generation job records
- Audit logs
- Helmet, compression, rate limiting, and readiness checks
- Dockerfiles and Docker Compose packaging

Read the complete architecture and request flows in [docs/system-design.md](docs/system-design.md).

Build the containers with:

```bash
docker compose build
docker compose up
```
