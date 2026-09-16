# ERP CRM Platform

A multi-tenant ERP and CRM platform built with React, TypeScript, Node.js, Express, PostgreSQL, Supabase, and OpenAI.

## Phase 1

Phase 1 establishes the monorepo foundation:

- `apps/web`: React + TypeScript frontend powered by Vite
- `apps/api`: Node.js + Express + TypeScript API
- Shared environment conventions
- Type-checking, linting, tests, and production builds
- GitHub Actions CI on every push and pull request

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
