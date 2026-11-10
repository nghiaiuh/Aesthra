# Skills Guide

Aesthra ships five canonical Agent Skills under `skills/`:

| Skill                | Responsibility                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `reference-analyzer` | Inspects accessible media, separates observations vs interpretations, preserves uncertainty     |
| `pattern-extractor`  | Generalizes recurring techniques into reusable `CandidatePatternDraft` structures               |
| `knowledge-curator`  | Compares candidates against existing knowledge, detects conflicts/duplicates, manages proposals |
| `creative-director`  | Retrieves relevant approved knowledge and personal Design DNA to synthesize creative direction  |
| `creative-critic`    | Audits concepts or drafts against the brief, design principles, and taste preferences           |

## Design Rules for Aesthra Skills

1. **Do not create one Skill per reference.** Skills encode repeatable workflows; visual insights belong in `knowledge/` or `memory/`.
2. **Keep task rubrics in `references/`**. Keep `SKILL.md` focused and modular, placing domain checklists in `skills/<name>/references/`.
3. **Never fabricate visual analysis.** Every Skill explicitly requires disclosing when visual tooling or media pixels are unavailable.
4. **Never mutate knowledge silently.** Skills route changes through `learning/inbox/` and require explicit human review (`approve --yes` / `reject`).

## Validating Skills

Run the skill validator after modifying any file under `skills/`:

```bash
pnpm validate:skills
```

It verifies:

- YAML frontmatter contains valid kebab-case `name` matching the directory name and a meaningful `description`.
- Required structural headings (`When to Use`, `Inputs`, `Workflow`, `Outputs`, `Constraints`) are present.
- All relative links inside `SKILL.md` (such as `references/dimensions-rubric.md`) resolve cleanly on disk.

## Authoring a New Skill

Only add a new Skill when you identify a genuinely repeatable multi-step capability (e.g., _storyboard pacing critique_ or _typography system audit_) that existing Skills cannot cover cleanly. Create `skills/<kebab-name>/SKILL.md`, run `pnpm validate:skills`, and update agent mirrors via `pnpm sync:skills`.
