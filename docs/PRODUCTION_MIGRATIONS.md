# Production database migrations

## Current status

The initial PostgreSQL migration `20261023000000_initial` was generated from the checked-in Prisma schema. The CI workflow now applies it to a disposable PostgreSQL 17 database and checks migration status; this passed on commit `553a7ef95487f9aa2887dc76eb588f4181aece54`.

**It has not been applied to any production or existing database.** Do not run the initial migration against an existing database until its schema has been compared and the baseline procedure below is complete.

## Fresh database

1. Provision an empty PostgreSQL database and configure `DATABASE_URL` and `DIRECT_URL` securely.
2. Confirm the hostname is the intended target and that a backup/restore path exists.
3. For a remote deployment, deliberately set `ELASTICO_ALLOW_REMOTE_DB_MUTATIONS=true`. If `NODE_ENV=production`, also set `ELASTICO_ALLOW_PRODUCTION_DB_MUTATIONS=true`.
4. Run:

   ```sh
   npm run db:migrate:deploy
   npx prisma migrate status
   ```

5. Confirm the application health check and a minimal authenticated database-backed journey before directing traffic.

The local-only `db:push`, `db:migrate`, and `db:reset` commands reject remote database hosts. Do not bypass those safeguards with direct Prisma CLI commands.

## Existing database: baseline before applying migrations

An existing database may have been created previously with `prisma db push` and may not have a Prisma migration history. The initial migration creates tables and indexes; applying it directly to an already-populated schema can fail or leave an inconsistent state.

1. **Take and verify an off-site backup first.** Do not paste credentials or backup contents into chat or CI logs.
2. Freeze schema changes and compare the existing database with the checked-in schema using the direct connection URL:

   ```sh
   npx prisma migrate diff --from-url "$DIRECT_URL" --to-schema-datamodel prisma/schema.prisma --script
   ```

   Review the entire output. If it proposes any changes, stop and reconcile the differences manually. Do not mark the migration applied based on a partial comparison.
3. Only after a verified backup and an exact schema match, explicitly opt in to remote/production database mutation and mark the initial migration as already applied **without executing its SQL**:

   ```sh
   npm run db:migrate:baseline
   ```

   This command records the baseline in Prisma's migration history. It does not create or alter the application tables.
4. Verify with `npx prisma migrate status`, then use `npm run db:migrate:deploy` for subsequent reviewed migrations.

If the schema does not match, do not run the baseline command. Reconcile the schema and create a reviewed forward migration first.

## Rollback and release rules

- Prisma migrations are forward-only unless explicit down migrations are authored and reviewed. For an unsafe schema change, restore from a verified backup or deploy a tested forward fix.
- Never use `prisma db push` against production.
- Never run the initial migration on an existing database before the baseline is verified.
- Keep production credentials in the deployment secret manager, not in repository files, shell history, issue comments, or chat.
- A passing disposable-database migration test proves fresh-install behavior only. It does not prove that an existing production database is correctly baselined or recoverable.
