## Summary

Describe the change and why it is needed.

## Checklist

- [ ] Code respects package boundaries (`core -> ingestion/memory -> analysis -> knowledge -> retrieval -> cli`).
- [ ] External inputs and persisted records are validated with Zod.
- [ ] No fabricated visual analysis or silent mutations to `knowledge/`, `memory/`, or `skills/`.
- [ ] No copyrighted third-party reference assets or secrets are included.
- [ ] Ran `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm validate:skills`.

