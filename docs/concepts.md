# Core Concepts

Aesthra separates creative intelligence into four distinct layers so inspiration never collapses into bloated prompt files or unverified guesses.

## Reference != Knowledge != Memory != Skill

| Concept       | Purpose                                                                               | Stored Under                                  | Example                                                                  |
| ------------- | ------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| **Reference** | Source pointer, provenance, rights, and technical metadata                            | `references/catalog/`, `references/analyses/` | A poster file `ref_abc` with SHA-256 hash and observations               |
| **Knowledge** | Reusable, domain-grounded creative principles, patterns, styles, and recipes          | `knowledge/**/*.md`                           | _Deliberate Negative Space_ or _Slow Camera Movement for Product Reveal_ |
| **Memory**    | Personal taste, explicit likes/dislikes, tentative hypotheses, decision audit history | `memory/design-dna.yaml`, `memory/*.jsonl`    | User explicitly prefers quiet warm palettes over neon gradients          |
| **Skill**     | Repeatable AI agent workflow instructions                                             | `skills/*/SKILL.md`                           | `reference-analyzer`, `pattern-extractor`, `creative-director`           |

## General Design Knowledge vs Personal Taste

Aesthra deliberately separates **what tends to work in a creative discipline** from **what this specific user prefers**:

- **General Design Knowledge (`knowledge/`)** explains structural principles, constraints, and common mistakes across mediums. Even if you dislike high-energy kinetic typography personally, it remains valid knowledge for briefs that require it.
- **Personal Taste (`memory/design-dna.yaml`)** tracks your explicit positive and negative preferences, plus tentative hypotheses that require confirmation before influencing creative direction strongly.

## Why Not One Skill Per Reference?

Creating a Skill for every saved image or video leads to prompt bloat and conflicting instructions. Aesthra maps discoveries to the smallest appropriate artifact:

- Single visual example -> Reference catalog
- Underlying structural rule -> Knowledge pattern
- Recognizable aesthetic vocabulary -> Style library (`knowledge/styles/`)
- Repeatable effect pairing -> Recipe (`knowledge/recipes/`)
- Personal preference -> Personal Design DNA (`memory/`)
- Genuinely new repeatable agent capability -> Skill (`skills/`)

## Progressive Knowledge Loading

AI agents should never load the entire `knowledge/` or `references/` tree into context. Use `pnpm brain search` with task keywords, `--domain`, and `--tag` filters to load only relevant entries along with `pnpm brain profile`.
