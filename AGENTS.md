# ERP CRM Platform — Agent Instructions

## Project purpose

This repository contains a multi-tenant B2B ERP/CRM platform built as a modular monolith for learning production-grade application architecture.

The platform will eventually support:

- Organizations and isolated workspaces
- Customer and contact management
- Leads, deals, and sales activities
- Products and inventory
- Invoices and payments
- Analytics and dashboards
- OpenAI-powered sales assistance
- A safe MCP server for CRM tools

## Repository structure

- `apps/web`: React, TypeScript, and Vite frontend
- `apps/api`: Node.js, Express, and TypeScript API
- `supabase/migrations`: versioned PostgreSQL schema and security migrations
- `.github/workflows`: GitHub Actions CI/CD workflows
- `.mcp.json`: development MCP server configuration

The project starts as a modular monolith. Keep module boundaries clear so individual modules can be extracted later if scale requires it.

## Technology rules

- Use TypeScript with strict mode enabled.
- Keep dependencies pinned or deliberately reviewed before upgrading them.
- Use React components and hooks for UI behavior.
- Put business rules in the API or database layer, not only in the frontend.
- Validate external input with Zod or an equivalent schema validator.
- Keep OpenAI calls server-side. Never expose `OPENAI_API_KEY` in browser code.
- Use TanStack Query, React Hook Form, Tailwind CSS, and shadcn/ui when those features are introduced.

## Multi-tenancy and authorization

Every business record must have an `organization_id` unless there is a documented reason otherwise.

Use both layers of authorization:

1. Application RBAC determines what a user is allowed to do.
2. PostgreSQL RLS determines which organization rows the user can access.

RLS requirements:

- Enable RLS on every table exposed through Supabase Data API.
- Never rely on `TO authenticated` alone; combine it with organization membership or permission checks.
- Write separate `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies where practical.
- For `UPDATE`, provide both `USING` and `WITH CHECK` conditions.
- Never use user-editable `user_metadata` for authorization decisions.
- Never expose a Supabase secret/service-role key to the frontend.
- Treat security-definer functions as privileged code. Keep them narrowly scoped, set a safe `search_path`, verify `auth.uid()`, and grant execution only to the required role.
- Add an RLS test or an equivalent verification whenever a new protected table is introduced.

## Database workflow

- Schema changes belong in `supabase/migrations`.
- Review migrations before applying them to any shared or production project.
- Do not place secrets, passwords, access tokens, or real customer data in migrations.
- Prefer additive, backwards-compatible migrations.
- Add indexes for organization and foreign-key lookup columns when appropriate.
- Keep seed/reference data deterministic and idempotent with `ON CONFLICT` where appropriate.

## MCP guidance

MCP is a development and integration boundary, not an authorization bypass.

- The Supabase MCP server may be used for schema inspection, documentation lookup, SQL verification, and database advisors.
- A future CRM MCP server must call authenticated application services and enforce the current user’s organization and permissions.
- Never create MCP tools that accept an organization ID and trust it without validating membership.
- Prefer narrowly scoped tools such as `find_customer`, `get_open_invoices`, or `get_low_stock_products` over unrestricted SQL tools.

## Commands

Install dependencies:

```bash
npm install
```

Run the frontend and API:

```bash
npm run dev
```

Run all checks before committing:

```bash
npm run check
```

The frontend runs on `http://localhost:5173` and the API runs on `http://localhost:4000`.

## Environment variables

Copy `.env.example` to `.env` for local development. Never commit `.env`.

Browser-exposed variables must use the `VITE_` prefix and must contain only publishable values. Server-only secrets must not use `VITE_`.

## Git workflow

- Work in small, focused commits.
- Run `npm run check` before committing.
- Keep `main` buildable.
- Push completed changes to the configured GitHub repository.
- Do not rewrite shared history or use destructive Git commands unless explicitly requested.
- Update the README when a phase changes setup or architecture.

## Definition of done

A change is complete only when:

- The implementation is scoped to the requested phase.
- Type-checking, linting, builds, and relevant tests pass.
- Security and tenant-isolation implications have been reviewed.
- Environment and migration instructions are updated when needed.
- The change has been committed and pushed if the user requested continuous GitHub updates.
