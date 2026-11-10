# Aesthra Roadmap

This roadmap reflects current implemented foundations alongside future milestones. Phases are ordered to preserve safety, provenance, and human review at every step.

## Phase 1: Creative Knowledge Foundation (Current Milestone — Implemented Core)

- [x] TypeScript pnpm monorepo (`core`, `ingestion`, `analysis`, `memory`, `knowledge`, `retrieval`, `cli`)
- [x] Zod data schemas for references, analyses, patterns, preferences, feedback, decisions, and proposals
- [x] Local file ingestion (SHA-256 hashing, native image header dimensions) and SSRF-safe URL registration
- [x] Provider-independent analysis interface + honest technical metadata fallback + structured JSON import
- [x] Deterministic pattern comparison (`new`, `similar`, `duplicate`, `extension`, `conflict`, `insufficient_evidence`)
- [x] Reviewable proposal inbox (`inbox`, `show`, `approve --yes`, `reject`) with atomic writes and audit trail
- [x] Personal Design DNA (`memory/design-dna.yaml`) separating explicit taste from tentative inferences
- [x] Local keyword retrieval across approved knowledge, references, and memory
- [x] Five canonical Agent Skills + Claude Code / Codex sync scripts + CI pipeline

## Phase 2: Multimodal Reference Analysis (Planned)

- [ ] Pluggable vision-capable LLM adapter interface (`AnalyzerProvider`) for local images
- [ ] Optional `ffmpeg` keyframe extraction + contact-sheet generation for video references
- [ ] Optional audio/pacing rhythm metadata extraction when authorized local video is provided

## Phase 3: Personalized Retrieval and Creative Reasoning (Planned)

- [ ] Optional local or remote embedding index (`KnowledgeRetriever` adapter) for semantic similarity
- [ ] Optional vector store adapter (e.g., Qdrant) behind existing `Retriever` and `KnowledgeComparator` interfaces
- [ ] Taste-weighted retrieval ranking incorporating explicit positive/negative Design DNA constraints
- [ ] Multi-reference synthesis briefs and collection management (`references/collections/`)

## Phase 4: Motion and Effect Registry (Planned)

- [ ] Executable effect schema and registry separated from conceptual `knowledge/` patterns
- [ ] Pluggable rendering/motion adapters (e.g., Remotion compositions, GSAP / WebGL motion modules)
- [ ] Parameterized creative recipes linking conceptual patterns to executable presets

## Phase 5: AI Creative Studio (Planned)

- [ ] Visual proposal diff viewer and side-by-side reference/pattern browser
- [ ] Interactive critique annotations feeding directly back into `memory/feedback.jsonl`
- [ ] Optional multi-profile workspaces while keeping local filesystem portability

