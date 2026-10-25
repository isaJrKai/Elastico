# Cloudflare Hosting Readiness — ELASTICO

Status: **assessment in progress; no deployment performed**

## Goal

Host ELASTICO in the existing Cloudflare account used for Mudaala without changing Mudaala's production resources. Keep application workers, secrets, database credentials, domains, and observability separate.

## Account capacity and cost checks

Cloudflare's current Workers limits documentation lists:

- Workers Free: 100,000 incoming requests per day at the account-plan level, 10 ms CPU per request, and up to 100 Workers per account.
- Workers Paid/Standard: no daily request cap in the limits table; pricing documentation lists 10 million requests per month included, with additional request and CPU charges beyond included usage.
- Worker CPU time, memory, bundle size, and subrequest limits still apply to each invocation.

Implication: two separate Workers fit within the Worker-count limit. On Free, however, both apps' request traffic can contribute to the same account-level daily request allowance. We must check the account's current plan and Mudaala's observed usage before deciding whether the Free allowance is sufficient. Do not upgrade or enable paid billing without the owner's approval.

## Current repository findings

- App framework: Next.js 16 App Router.
- Current build mode: `output: "standalone"`; package build script copies standalone assets. This is a Node/container-oriented output path and is not, by itself, a Cloudflare Workers deployment configuration.
- Database: PostgreSQL through Prisma ORM 6.19.x. The Prisma schema uses the `prisma-client-js` generator and both `DATABASE_URL` and `DIRECT_URL`.
- The environment example points to Neon PostgreSQL. Keep ELASTICO's database separate from Mudaala's database. Do not migrate to D1 merely to host on Cloudflare.
- Dependencies include `canvas` and `sharp`, which need import/use-site auditing because native Node binaries are not generally portable to the Workers runtime. `better-sqlite3` is currently a dev dependency but must not be pulled into runtime bundles.
- The database helper constructs a module-level PrismaClient. Before adopting a Workers runtime, validate the correct Neon/Prisma driver adapter and connection lifecycle against the actual runtime; do not assume the existing Node setup will work unchanged.
- No Cloudflare Worker/OpenNext configuration has been added by this assessment.

## Recommended investigation order

1. Confirm the Cloudflare account plan and review Mudaala's request/CPU usage without changing its configuration.
2. Audit all server-side imports/usages of `canvas`, `sharp`, Node-only APIs, filesystem access, and other native packages.
3. Choose the deployment adapter after a compatibility test. Cloudflare currently recommends vinext for new Next.js-on-Workers deployments but documents it as beta; OpenNext is an alternative for existing apps when its compatibility fits.
4. Validate Prisma + Neon connectivity using a supported Workers-compatible driver/adapter and safe connection handling.
5. Add an isolated ELASTICO preview Worker and its own environment variables/secrets. Never copy Mudaala secrets.
6. Run smoke tests for login, database-backed pages, match/team/player APIs, prediction calculations, and error handling in preview.
7. Only after preview passes, prepare a production release plan for explicit owner approval.

## Release gates

- [ ] Confirm account plan and current Mudaala usage.
- [ ] Complete Node/native dependency compatibility inventory.
- [ ] Prove Prisma/Neon connection works in Workers preview.
- [ ] Build and deploy isolated ELASTICO preview.
- [ ] Verify real app flows and production environment variables.
- [ ] Review costs and monitoring.
- [ ] Obtain explicit approval before production deployment.

## References

- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare Next.js/vinext guide: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Cloudflare OpenNext guide: https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/
- Prisma ORM edge deployment guidance: https://www.prisma.io/docs/orm/v6/prisma-client/deployment/edge/deploy-to-cloudflare

This is a preliminary compatibility assessment, not a declaration that ELASTICO is deployable or production-ready.
