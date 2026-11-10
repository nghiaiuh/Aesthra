---
name: pattern-extractor
description: Converts supported creative observations into reusable, domain-grounded candidate knowledge patterns without simply restating visual descriptions or creating per-reference skills.
---

# Pattern Extractor

## When to Use

Trigger after a reference has a valid `CreativeAnalysis` and the user or pipeline wants to extract generalizable creative principles, layout patterns, styles, or recipes.

## Inputs

- A `CreativeAnalysis` record in `references/analyses/<id>.json`.
- Existing reference metadata and user notes in `references/catalog/<id>.json`.

## Workflow

1. **Verify sufficient evidence**: Confirm the analysis contains substantive visual or user-verified observations (`analysisKind !== 'technical_metadata'`). Refuse to generalize from URLs, filenames, or brief 1-line notes alone.
2. **Distill the underlying principle**: Ask _why_ the technique works perceptually or structurally rather than copying surface aesthetics from one reference.
3. **Classify the destination properly**:
   - General design principle -> `knowledge/foundations/` or domain folder (`cinematic/`, `graphic-design/`, `motion-design/`).
   - Reusable structural/motion pattern -> `knowledge/patterns/`.
   - Cohesive visual language -> `knowledge/styles/`.
   - Reusable technique combination -> `knowledge/recipes/`.
   - Personal taste statement -> `memory/design-dna.yaml` proposal (never general knowledge).
   - Never create a new Skill merely for a single visual reference.
4. **Define boundaries**: For every `CandidatePatternDraft`, specify `principle`, `whyItWorks`, `useCases`, `constraints`, `commonMistakes`, and honest `confidence`.
5. **Attach provenance**: Keep `referenceId` and observation IDs linked cleanly inside `extractedPatterns`.

## Outputs

- Candidate pattern drafts embedded in `CreativeAnalysis.extractedPatterns` ready for `pnpm brain propose <reference-id>`.

## Constraints

- Never restate raw pixel descriptions as a design principle.
- Do not confuse personal user preference ("I like warm terracotta") with universal design truth.
- Never write candidate patterns straight into `knowledge/` without passing through curator comparison and human review.
