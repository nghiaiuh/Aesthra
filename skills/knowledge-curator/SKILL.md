---
name: knowledge-curator
description: Compares candidate creative patterns against existing knowledge, detects duplicates and conflicts, generates reviewable learning proposals, and applies only human-approved changes safely.
---

# Knowledge Curator

## When to Use

Trigger when generating learning proposals from analyzed references, reviewing the learning inbox, resolving duplicate or conflicting patterns, or safely integrating approved updates.

## Inputs

- Analyzed reference ID and candidate patterns (`references/analyses/`).
- Current approved patterns under `knowledge/`.
- Personal Design DNA in `memory/design-dna.yaml`.

## Workflow

1. **Generate proposals**: Run `pnpm brain propose <reference-id>` (add `--prefer` / `--avoid` only when the user explicitly stated personal taste).
2. **Compare against existing knowledge**: Inspect `comparisonOutcome` (`new`, `similar`, `duplicate`, `extension`, `conflict`, `insufficient_evidence`):
   - Skip or merge exact duplicates instead of bloating the library.
   - Surface conflicts explicitly with target IDs and reasons rather than silently overwriting curated guidance.
3. **Present for human inspection**: Direct the user to `pnpm brain inbox` and `pnpm brain show <proposal-id>` to inspect rationale, evidence, target path, and diff preview.
4. **Apply only explicit approvals**:
   - Approved -> `pnpm brain approve <proposal-id> --yes` (after explicit user consent).
   - Rejected -> `pnpm brain reject <proposal-id> --reason "<why>"`.
5. **Prevent Skill proliferation**: Only propose `new_skill` or `skill_update` when a genuinely repeatable agent workflow emerges, never for individual references.

## Outputs

- Pending proposals in `learning/inbox/`, decision logs in `memory/decisions.jsonl`, and validated Markdown updates in `knowledge/` upon explicit approval.

## Constraints

- Never silently edit approved `knowledge/` files, `memory/design-dna.yaml`, or `skills/*/SKILL.md`.
- Reject path traversal, unexpected concurrent file edits (`baseFileHash` mismatch), or schema-invalid payloads.
- Always preserve `sourceReferenceIds` provenance.

