# Production reconciliation

Fail-closed checks for the production channel: npm/Vercel build shape, the official `npm run build`, music and public asset manifests, commit ancestry, and the attested release record.

The CLI does not deploy, does not create staging, and does not modify `records/production.json`.

```sh
node --test deployment/reconciliation/*.test.mjs
node deployment/reconciliation/cli.mjs
```

See `RUNBOOK.md` for the human attestation and rollback procedure, and `PRODUCTION-DEPLOY-PLAN.md` for the current go/no-go.
