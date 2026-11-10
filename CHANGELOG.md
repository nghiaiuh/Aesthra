# Changelog

All notable changes to Aesthra will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial pnpm TypeScript monorepo foundation (`@aesthra/core`, `@aesthra/ingestion`, `@aesthra/analysis`, `@aesthra/memory`, `@aesthra/knowledge`, `@aesthra/retrieval`, `@aesthra/cli`).
- Zod-validated schemas for `CreativeReference`, `CreativeAnalysis`, `KnowledgePattern`, `PersonalPreference`, `DesignDna`, `FeedbackEvent`, `DecisionRecord`, and `LearningProposal`.
- Full local learning workflow via `pnpm brain`: `learn`, `analyze`, `propose`, `inbox`, `show`, `approve`, `reject`, `search`, `profile`, and `doctor`.
- Illustrative initial knowledge entries and Personal Design DNA structure (`memory/design-dna.yaml`).
- Five canonical Agent Skills (`reference-analyzer`, `pattern-extractor`, `knowledge-curator`, `creative-director`, `creative-critic`) with `pnpm sync:skills` and `pnpm validate:skills`.
- Unit and integration test suites plus GitHub Actions CI workflow.

