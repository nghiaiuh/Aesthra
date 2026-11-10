# Agent Integration (Claude Code & Codex)

Aesthra is built to integrate cleanly with coding and creative agents including **Claude Code** and **Codex**, using the repository root `skills/` directory as the single canonical source of truth.

## Instruction Files

- [`AGENTS.md`](../AGENTS.md): Shared project conventions, package boundaries, safety rules, and validation commands (discovered natively by Codex and multi-agent tools).
- [`CLAUDE.md`](../CLAUDE.md): Complementary Claude Code workflow notes referencing `AGENTS.md`.

## Exposing Canonical Skills

Different agent runtimes expect project-local Skills in different paths:

- **Claude Code**: `.claude/skills/<skill-name>/`
- **Codex / Agent Skills standard**: `.agents/skills/<skill-name>/`

Instead of maintaining manual duplicates in Git, Aesthra provides a cross-platform sync script (`scripts/sync-skills.ts`):

```bash
# Sync to both .claude/skills/ and .agents/skills/
pnpm sync:skills

# Or target a single runtime
pnpm sync:skills --target claude
pnpm sync:skills --target codex

# Preview without modifying files
pnpm sync:skills --dry-run

# Verify existing mirrors match canonical skills/
pnpm sync:skills --check
```

`.claude/skills/` and `.agents/skills/` are listed in `.gitignore` so canonical edits always happen in `skills/` without duplicate drift in commits.

## Environment Considerations & Limitations

- **Copy vs Symlink**: `pnpm sync:skills` performs clean directory copies across Windows, macOS, and Linux so Windows developers never hit symlink permission errors.
- **Vision capabilities depend on the host agent**: When running inside Claude Code or Codex, if the host session allows viewing local image files directly, the agent can inspect a local poster/image, author structured `CreativeAnalysis` JSON, and import it with `pnpm brain analyze <id> --import <file.json>`. For video files or remote URLs where frames are not accessible to the agent, the agent must report that limitation instead of guessing visual details.
- **Non-interactive safety**: Running `pnpm brain approve <id>` without `--yes` in an agent shell intentionally fails so agents cannot silently approve their own proposals without explicit user authorization.

