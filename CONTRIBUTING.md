# Contributing to Aesthra

Thank you for helping build **Aesthra** (_Intelligence Shaped by Taste_).

## Development Environment

- **Node.js:** `>= 22.0.0`
- **pnpm:** `>= 10.0.0`
- **Optional:** `ffmpeg` / `ffprobe` for future/optional video stream inspection. Not required for core tests or CLI workflows.

## Installation

```bash
git clone <repository-url>
cd aesthra
pnpm install
pnpm brain doctor
```

## Workspace & Package Conventions

Keep the workspace dependency graph strictly acyclic:

- `packages/core`: Shared Zod schemas, errors, IDs, safe path checks, atomic FS helpers.
- `packages/ingestion`: Reference registration, SHA-256 hashing, media metadata, SSRF-safe URL validation.
- `packages/analysis`: Provider interfaces, technical metadata inspection, structured JSON analysis import.
- `packages/memory`: Personal Design DNA (`memory/design-dna.yaml`) and JSONL audit logs.
- `packages/knowledge`: Markdown pattern parser/serializer, comparator, proposal inbox, safe curator.
- `packages/retrieval`: Local keyword retrieval across approved knowledge, references, and memory.
- `apps/cli`: Thin Commander CLI handlers (`pnpm brain` / `aesthra`).

## Code Style

- TypeScript strict mode (`strict: true`, `noUncheckedIndexedAccess: true`), ESM (`NodeNext`).
- Avoid `any`; validate persisted data and CLI boundaries with Zod.
- Keep business logic inside `packages/*`, not inside Commander definitions.
- Run formatting and lint before opening a PR:

```bash
pnpm format
pnpm lint
pnpm typecheck
```

## Testing

- Unit tests live alongside package source (`packages/*/src/*.test.ts`); end-to-end tests live in `tests/integration/`.
- Tests must use isolated temporary directories (`fs.mkdtemp`) and run offline without paid APIs.
- Verify everything passes:

```bash
pnpm test
pnpm build
pnpm validate:skills
```

## Contributing Skills and Design Patterns

- **Skills (`skills/`)**: Propose a new Skill only for a genuinely repeatable agent workflow—never one Skill per reference. Every `SKILL.md` must pass `pnpm validate:skills`, clearly disclose unavailable visual tools, and forbid silent mutations.
- **Knowledge Patterns (`knowledge/`)**: Write reusable principles, constraints, and common mistakes using the standard frontmatter + Markdown sections documented in [docs/knowledge-schema.md](docs/knowledge-schema.md). Mark illustrative seeds clearly (`origin: illustrative_seed`) and never fabricate external reference attribution.

## Reference Rights & Provenance

Never commit copyrighted third-party images, videos, scraped web pages, private personal taste logs, or API secrets. See [docs/reference-policy.md](docs/reference-policy.md) and [SECURITY.md](SECURITY.md).
