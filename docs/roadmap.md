# Documentation Roadmap Summary

See [ROADMAP.md](../ROADMAP.md) at the repository root for the authoritative phased roadmap and completion checklist.

## Architectural Extension Points Already Prepared

Even though Phases 2–5 are planned future work, the current codebase defines small, concrete interfaces so new capabilities slot in cleanly without rewriting core workflows:

1. **`AnalyzerProvider`** (`packages/analysis/src/provider.ts`): Allows multimodal vision adapters or local `ffmpeg` frame extractors to produce standard `CreativeAnalysis` records.
2. **`KnowledgeComparator`** (`packages/knowledge/src/comparator.ts`): Allows semantic embedding similarity checks to augment or replace deterministic token comparison.
3. **`KnowledgeRetriever`** (`packages/retrieval/src/types.ts`): Allows vector index retrievers (e.g., Qdrant) to plug behind `RetrievalService` while preserving domain/tag filtering and provenance.
4. **Effect Registry (Phase 4)**: Planned as a separate executable layer so conceptual `knowledge/` patterns remain decoupled from rendering tools such as Remotion or GSAP.

