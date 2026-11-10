import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AnalysisService } from '@aesthra/analysis';
import { IngestionService } from '@aesthra/ingestion';
import { KnowledgeCurator } from '@aesthra/knowledge';
import { MemoryService } from '@aesthra/memory';
import { RetrievalService } from '@aesthra/retrieval';
import { createMinimalPngBuffer, createTempWorkspace } from '../fixtures/helpers.js';

describe('End-to-End Learning Pipeline', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      await cleanups.pop()?.();
    }
  });

  it('completes Reference -> Structured Analysis -> Proposal -> Approval -> Knowledge Retrieval', async () => {
    const ws = await createTempWorkspace();
    cleanups.push(ws.cleanup);

    const posterPath = path.join(ws.root, 'fixture-poster.png');
    await fs.writeFile(posterPath, createMinimalPngBuffer(600, 800));

    // 1. Ingest reference
    const ingestion = new IngestionService(ws.paths);
    const { reference } = await ingestion.registerLocalFile({
      filePath: posterPath,
      sourceType: 'poster',
      tags: ['editorial', 'negative-space'],
      notes: 'Strong asymmetric weight at bottom left.',
    });

    // 2. Import structured analysis
    const analysisJsonPath = path.join(ws.root, 'analysis.json');
    await fs.writeFile(
      analysisJsonPath,
      JSON.stringify({
        observations: [
          {
            dimension: 'composition',
            statement: 'Upper 55% of canvas remains open dark ground.',
            evidenceType: 'user_observation',
          },
        ],
        interpretations: [
          {
            dimension: 'emotionalTone',
            statement: 'Calm architectural authority.',
            rationale: 'Lower gravitational mass balances open headroom.',
            evidenceType: 'user_interpretation',
          },
        ],
        uncertainty: ['Font metrics absent from pixel-only fixture.'],
        extractedPatterns: [
          {
            name: 'Lower-Third Gravitational Anchor',
            category: 'patterns',
            domain: 'graphic-design',
            summary: 'Anchoring visual weight in the lower third with open headroom.',
            principle: 'Offset heavy visual mass below midline while keeping upper margins empty.',
            whyItWorks: 'Perceived physical gravity grounds the frame without static symmetry.',
            useCases: ['Exhibition posters', 'Hero titles'],
            constraints: ['Avoid scattering badges into upper silence zone.'],
            commonMistakes: ['Floating disconnected labels mid-frame.'],
            tags: ['gravity', 'composition', 'editorial'],
            confidence: 0.87,
          },
        ],
      }),
    );

    const analysisService = new AnalysisService(ws.paths);
    const analyzed = await analysisService.importAnalysisFromFile(reference.id, analysisJsonPath);
    expect(analyzed.reference.status).toBe('analyzed');

    // 3. Generate proposals (knowledge + explicit preference)
    const curator = new KnowledgeCurator(ws.paths);
    const proposalReport = await curator.generateProposalsForReference(reference.id, {
      explicitPreference: {
        category: 'composition',
        preference: 'Prefer asymmetric lower-third anchoring with generous headroom',
        polarity: 'prefer',
        rationale: 'Matches personal editorial taste.',
      },
    });

    expect(proposalReport.proposals).toHaveLength(2);
    const knowledgeProp = proposalReport.proposals.find(
      (p) => p.proposalType === 'knowledge_pattern',
    );
    const prefProp = proposalReport.proposals.find((p) => p.proposalType === 'preference');
    expect(knowledgeProp).toBeDefined();
    expect(prefProp).toBeDefined();
    if (!knowledgeProp || !prefProp) return;

    // Curated knowledge and Design DNA must still be empty before approval
    const retrieval = new RetrievalService(ws.paths);
    const beforeSearch = await retrieval.search({ query: 'gravitational anchor' });
    expect(beforeSearch.totalMatched).toBe(0);

    // 4. Approve knowledge proposal, reject preference proposal
    await curator.approveProposal(knowledgeProp.id, { reviewNote: 'Verified pattern' });
    await curator.rejectProposal(prefProp.id, { reviewNote: 'Too specific for Design DNA yet' });

    // 5. Retrieve approved knowledge & verify rejected preference did not mutate Design DNA
    const afterSearch = await retrieval.search({
      query: 'gravitational anchor',
      includeReferences: true,
      includeMemory: true,
    });

    expect(afterSearch.retrievalMode).toBe('local_keyword');
    expect(afterSearch.items.some((item) => item.id === 'lower-third-gravitational-anchor')).toBe(
      true,
    );
    const matchedPattern = afterSearch.items.find(
      (item) => item.id === 'lower-third-gravitational-anchor',
    );
    expect(matchedPattern?.provenance).toContain(reference.id);

    const memory = new MemoryService(ws.paths);
    const profile = await memory.getProfile();
    expect(profile.preferences).toHaveLength(0);
    expect(profile.recentDecisions).toHaveLength(2);
    expect(profile.recentDecisions.map((d) => d.decision)).toEqual(['approved', 'rejected']);
  });
});

