# Knowledge & Data Schemas

All persisted data in Aesthra is validated with Zod schemas defined in `packages/core/src/schemas.ts`.

## Core Entities

### `CreativeReference` (`references/catalog/ref_*.json`)

- **Required**: `id`, `sourceType` (`image | video | poster | website | other`), `title`, `importedAt`, `status` (`registered | pending_analysis | analyzed | analysis_failed`), and at least one of `localPath` or `sourceUrl`.
- **Provenance & Rights**: `sourceAttribution`, `licenseInformation`, `contentHash` (`sha256:...`), `canonicalUrl`, `userNotes[]`, `analysisIds[]`.

### `CreativeAnalysis` (`references/analyses/ana_*.json`)

- `analysisKind`: `technical_metadata | manual_structured | hybrid | vision_model`.
- `observations[]`: direct verifiable facts with `evidenceType` (`technical_metadata | user_observation | model_observation | verified_observation`).
- `interpretations[]`: subjective readings with `rationale` and `evidenceType` (`user_interpretation | model_interpretation | uncertain_interpretation`).
- `uncertainty[]`: explicit limitations, inaccessible media, or unverified aspects.
- `sourceEvidence`: `mediaAccessible`, `inspectedSourceType`, `contentHash`, `limitations[]`.

### `KnowledgePattern` (`knowledge/<category>/<id>.md`)

Stored as human-editable Markdown with YAML frontmatter:

- **Frontmatter**: `id` (kebab-case), `name`, `category` (`foundations | cinematic | graphic-design | motion-design | patterns | styles | recipes`), `domain`, `summary`, `tags`, `origin` (`illustrative_seed | learned_reference | manual_authoring`), `sourceReferenceIds`, `relatedPatternIds`, `confidence`, `status` (`draft | approved | deprecated`), `createdAt`, `updatedAt`.
- **Body Sections**:
  - `## Summary`
  - `## Visual or Cinematic Principle`
  - `## Why It Works`
  - `## Practical Application`
  - `## Constraints`
  - `## Common Mistakes`
  - `## References`
  - `## Related Patterns`

### `PersonalPreference` & `DesignDna` (`memory/design-dna.yaml`)

- Categories: `visual_identity`, `composition`, `typography`, `color`, `lighting`, `motion`, `cinematic_language`, `creative_influences`, `negative_preferences`.
- Each category maintains separate `explicit` and `tentative` lists.
- Append-only logs in `memory/feedback.jsonl`, `memory/preferences.jsonl`, and `memory/decisions.jsonl` maintain full audit provenance.

### `LearningProposal` (`learning/inbox/prop_*.json`)

- `proposalType`: `knowledge_pattern | style | recipe | preference | skill_update | new_skill`.
- `status`: `pending | approved | rejected | applied | failed`.
- `comparisonOutcome`: `new | similar | duplicate | extension | conflict | insufficient_evidence`.
- `baseFileHash`: recorded on `update` proposals to reject unexpected external modifications at apply time.

