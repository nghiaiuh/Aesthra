# CLAUDE.md — Claude Code Guide for Aesthra

Read [AGENTS.md](AGENTS.md) for core architecture, package boundaries, and safety rules. This file highlights Claude Code-specific workflow conventions.

## Syncing Skills for Claude Code

`skills/` is the single canonical source of truth. Populate `.claude/skills/` (gitignored mirror) before running skill-guided sessions in Claude Code:

```bash
pnpm sync:skills --target claude
```

## Using Aesthra During Creative Sessions

1. **Check environment**: `pnpm brain doctor`
2. **Register a reference**: `pnpm brain learn --file <path> --notes "<why it stands out>"` (or `--url <url>`)
3. **Inspect or import analysis**:
   - If Claude has vision access to the local image file, follow `skills/reference-analyzer/SKILL.md`, clearly separate direct observations from interpretations, save structured JSON, and run `pnpm brain analyze <ref-id> --import <analysis.json>`.
   - If visual content is inaccessible (e.g., video frames or remote URL without local assets), disclose the limitation and run `pnpm brain analyze <ref-id>` for technical metadata only.
4. **Propose & review**: `pnpm brain propose <ref-id>` -> `pnpm brain inbox` -> `pnpm brain show <prop-id>`. Wait for explicit human confirmation before running `pnpm brain approve <prop-id> --yes`.
5. **Direct or critique work**: Use `pnpm brain search "<query>" --include-memory` and `pnpm brain profile` with `skills/creative-director/SKILL.md` or `skills/creative-critic/SKILL.md`.

## Code Style & Testing Conventions

- TypeScript strict mode (`NodeNext` ESM), Zod validation at file/CLI boundaries, zero `any`.
- Keep business logic inside `packages/*`; keep `apps/cli/src/commands/*` thin and testable.
- Every filesystem test must use isolated temporary directories via `fs.mkdtemp`.

