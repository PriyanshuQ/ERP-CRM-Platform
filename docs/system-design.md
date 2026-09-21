# ERP CRM Platform — System Design and Application Flow

## 1. Purpose

This project is a multi-tenant ERP/CRM for B2B organizations. Each organization has an isolated workspace for customers, activities, products, inventory, invoices, analytics, and AI-assisted sales work.

The system is intentionally designed as a modular monolith first. It has one deployable API, but each domain owns its routes, validation, services, persistence rules, and tests. This gives us a simple development and deployment model while preserving boundaries for future extraction.

## 2. High-level architecture

```text
Browser
  │
  ├── React + TypeScript + Tailwind/shadcn UI
  ├── TanStack Query for server state
  └── React Hook Form + Zod for forms
          │ HTTPS + Supabase access token
          ▼
Load balancer / reverse proxy
          │
          ▼
Stateless Node.js + Express API replicas
  ├── authentication middleware
  ├── validation middleware
  ├── customer module
  ├── inventory module
  ├── invoicing module
  ├── analytics module
  ├── OpenAI integration
  └── audit/error/rate-limit middleware
          │ user-scoped Supabase client
          ▼
Supabase
  ├── Auth
  ├── PostgreSQL
  ├── Row-Level Security
  ├── Storage
  └── optional Realtime/Edge Functions

Slow or retryable work:
API -> durable job record/queue -> worker -> downstream API -> database
```

## 3. Supabase/Azure mapping

Supabase is the managed backend used for this learning project. If deployed on Azure, the equivalent architecture would be:

| Current project | Azure-oriented equivalent |
|---|---|
| Supabase PostgreSQL | Azure Database for PostgreSQL |
| Supabase Auth | Microsoft Entra ID or an application identity provider |
| Supabase Storage | Azure Blob Storage |
| Express container | Azure Container Apps or App Service |
| Queue worker | Azure Service Bus worker |
| Redis cache | Azure Cache for Redis |
| Secrets | Azure Key Vault |
| Logs/metrics | Azure Monitor/Application Insights |
| GitHub Actions | GitHub Actions deploying to Azure |

Application RBAC remains application code/database logic. Azure RBAC controls access to Azure infrastructure; they are separate concerns.

## 4. Multi-tenancy model

The tenant is an organization. Users are not directly assigned access to every business row. They are assigned a membership:

```text
auth.users
  └── organization_members
        ├── organization_id
        ├── user_id
        └── role_id
              └── role_permissions
                    └── permissions
```

Business tables contain `organization_id`:

```text
customers
products
warehouses
stock_movements
invoices
activities
ai_generations
audit_logs
```

This enables both fast query filtering and database-level isolation.

## 5. Authentication flow

```text
1. User submits email/password in React.
2. Supabase Auth verifies the credentials.
3. Supabase returns an access token and refresh token.
4. The browser stores the session using the Supabase client.
5. React observes session changes through onAuthStateChange.
6. API requests send Authorization: Bearer <access-token>.
7. Express calls Supabase Auth to validate the token.
8. Express creates a Supabase client carrying the user token.
9. PostgreSQL evaluates the request as the authenticated user.
```

The frontend publishable key may be exposed in browser code when RLS and grants are correctly configured. The secret/service-role key must remain server-side and is reserved for controlled administrative or worker operations.

## 6. Authorization flow

Authentication only establishes identity. Authorization happens at two layers:

```text
Request
  ├── Express: is user authenticated?
  ├── Express/service: does the action require a permission?
  └── PostgreSQL RLS: can this user access this organization row?
```

Example permission decision:

```text
User requests POST /api/v1/customers
  -> token valid
  -> user has customers.manage through membership role
  -> organization_id is a member organization
  -> RLS allows INSERT and created_by matches auth.uid()
  -> row is created
```

The UI may hide a button, but the UI is not trusted. A user can call the API manually, so the API and database repeat the security decision.

## 7. Customer creation flow

```text
Customer form
  -> React Hook Form collects fields
  -> Zod validates browser input
  -> TanStack Query mutation starts
  -> fetch sends Bearer token and x-organization-id
  -> Express requireAuth validates token
  -> route parses request body with Zod
  -> service adds organization_id and created_by
  -> Supabase inserts using the user-scoped JWT
  -> RLS checks customers.manage and organization membership
  -> API returns 201 with created customer
  -> Query invalidates ["customers"]
  -> directory refetches
```

The browser validation improves feedback, but the API validation is mandatory because any client can bypass the browser.

## 8. Inventory flow

Inventory uses products, warehouses, inventory levels, and stock movements.

```text
Product + Warehouse
       └── inventory_levels(quantity, reserved_quantity)

Every adjustment
  -> validate product/warehouse/permission
  -> create stock movement
  -> update inventory level in a transaction
  -> write audit log
```

The movement table is the history. The inventory-level table is the current read model. This gives fast reads while preserving an auditable history of changes.

For concurrency, stock updates should use a transaction and a row lock or an atomic update. Two simultaneous sales must not both observe the same available quantity.

## 9. Invoicing flow

```text
Draft invoice
  -> select organization customer
  -> add invoice items
  -> calculate subtotal/tax on trusted server logic
  -> save invoice and items transactionally
  -> status changes draft -> sent -> paid/overdue
  -> audit each status transition
```

The client may show calculated totals for responsiveness, but the server recalculates totals from trusted item values. Monetary values use PostgreSQL numeric types rather than floating-point JavaScript arithmetic.

If sending an invoice email fails after invoice creation, the invoice remains created and email delivery becomes a separate retryable job. This is partial failure handling rather than pretending two external systems share one transaction.

## 10. OpenAI flow

OpenAI is called by the API or worker, never directly from the browser:

```text
React requests sales email
  -> API authenticates user and organization
  -> service selects minimum permitted customer context
  -> idempotency key is checked
  -> ai_generations row is pending
  -> short work may call OpenAI directly
  -> long work is queued for a worker
  -> worker calls OpenAI with timeout/retry policy
  -> output is schema-validated
  -> usage and result are stored
  -> frontend receives or polls for result
```

AI jobs have explicit states: `pending`, `processing`, `completed`, and `failed`. This supports retries, observability, and recovery after a worker crash.

## 11. API module structure

```text
apps/api/src
  ├── app.ts
  ├── auth.ts
  ├── modules
  │   ├── customers
  │   │   ├── customer.router.ts
  │   │   ├── customer.schemas.ts
  │   │   └── customer.service.ts
  │   ├── inventory
  │   ├── invoices
  │   └── analytics
  └── types/express.d.ts
```

Each module should follow:

```text
Router -> Controller/handler -> Schema -> Service -> Data access
```

The current customer module combines handlers and controller logic while the module is small. As it grows, handlers should move into controllers and data calls into repositories.

## 12. Scaling to 500+ simultaneous requests

500 concurrent requests is not the same as 500 requests per second. Capacity depends on request mix, database latency, payload size, downstream calls, and latency goals.

The intended scale path is:

```text
CDN/reverse proxy
  -> load balancer
    -> API replica 1
    -> API replica 2
    -> API replica 3
      -> bounded connection pool/pooler
        -> PostgreSQL
```

Rules:

- Keep API instances stateless.
- Do not store sessions or job state only in process memory.
- Use a bounded database pool rather than one connection per request.
- Index `organization_id`, foreign keys, status filters, and common sort columns.
- Use keyset pagination for large lists.
- Avoid N+1 queries and `SELECT *` in high-volume paths.
- Cache safe read-heavy results with tenant-aware cache keys.
- Move OpenAI, exports, and heavy reports to workers.
- Apply per-user and per-organization rate limits.
- Measure p50, p95, p99, error rate, pool saturation, queue depth, and downstream latency.

Example tenant-safe cache key:

```text
organization:{organizationId}:dashboard:{dateRange}
```

Never use a cache key that omits tenant identity.

## 13. Failure and retry model

Transient failures include timeouts, connection resets, and temporary 5xx responses. Permanent failures include validation errors, authorization failures, and malformed requests.

```text
Permanent failure -> return immediately with stable error code
Transient failure -> bounded retry with exponential backoff and jitter
Repeated failure -> circuit breaker or durable queue
Unknown outcome -> idempotency/reconciliation check
```

For a multi-step workflow, use durable state or an outbox:

```text
created -> processing -> completed
                    \-> failed -> retrying
```

Retries must be safe. Customer, invoice, payment, and AI operations should accept an idempotency key where duplicate side effects would be harmful.

## 14. MCP and subagents

MCP is an integration boundary for AI tools. The future CRM MCP server should expose narrow operations such as `find_customer`, `get_open_invoices`, and `get_low_stock_products`.

```text
AI host -> MCP client -> CRM MCP server -> authenticated API -> RLS database
```

The MCP server must validate the caller, derive tenant context from authentication, check permissions, validate tool input, and audit mutating actions. It must not expose unrestricted SQL.

Subagents are specialized engineering workers:

```text
Main agent
  ├── database/RLS agent
  ├── backend API agent
  ├── frontend agent
  ├── testing agent
  ├── security agent
  └── performance agent
```

The main agent remains responsible for integration, cross-module consistency, and final verification.

## 15. Deployment flow

```text
Developer push
  -> GitHub Actions
     -> npm ci
     -> typecheck/lint/test/build
     -> build Docker image
     -> scan image/dependencies
     -> deploy web and API
     -> apply reviewed database migration
     -> readiness check
```

Local Docker services:

- API image: `Dockerfile.api`, port 4000
- Web image: `apps/web/Dockerfile`, port 8080
- Supabase remains a managed dependency unless the Supabase CLI/local stack is added later

Production secrets belong in a secret manager such as Azure Key Vault or the deployment platform’s secret store. `.env` is local-only.

## 16. Security checklist

- Never commit `.env` or secret keys.
- Never expose service-role/secret Supabase keys in the browser.
- Enable RLS on every exposed business table.
- Use organization-aware policies, not only `TO authenticated`.
- Use both `USING` and `WITH CHECK` for updates.
- Keep security-definer functions narrowly scoped with a safe search path.
- Validate request bodies, query parameters, and tool inputs at runtime.
- Add rate limits to auth, mutation, and AI endpoints.
- Keep audit logs for sensitive actions.
- Test cross-organization access denial.

## 17. Current implementation status

Implemented in the repository:

- React/Vite frontend and Express API
- Supabase Auth client and JWT middleware
- Organization/membership/RBAC migration
- Customer CRUD API and UI
- Customer RLS migration
- Inventory, invoicing, activities, AI-job, and audit-log schema
- Docker images and Compose configuration
- GitHub Actions validation

Requires a real Supabase project to verify end-to-end:

- Applying migrations
- Creating a user and organization
- Testing RLS allow/deny cases
- Running customer CRUD with real JWTs
- Running production load tests
- Adding production queue/cache/observability providers

## 18. Definition of production readiness

The educational MVP is complete when the migrations apply, the core workflows work with real authentication, RLS isolation tests pass, CI is green, Docker images start, and load tests document capacity.

It is production-ready only after secrets, backups, monitoring, incident response, deployment rollback, dependency scanning, load testing, and a real hosting environment are configured.
