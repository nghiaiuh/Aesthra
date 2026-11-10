import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AnalysisService } from '@aesthra/analysis';
import {
  ConflictError,
  type KnowledgePattern,
  type LearningProposal,
  PathSecurityError,
  createStableId,
  nowIso,
} from '@aesthra/core';
import { IngestionService } from '@aesthra/ingestion';
import {
  DeterministicKnowledgeComparator,
  KnowledgeCurator,
  parseKnowledgePatternMarkdown,
  serializeKnowledgePatternMarkdown,
} from '@aesthra/knowledge';
import { createMinimalPngBuffer, createTempWorkspace } from '../../../tests/fixtures/helpers.js';

function makeSeedPattern(overrides?: Partial<KnowledgePattern>): KnowledgePattern {
  const ts = nowIso();
  return {
    id: 'deliberate-negative-space',
    name: 'Deliberate Negative Space',
    category: 'foundations',
    domain: 'graphic-design',
    summary: 'Leaving generous empty space around primary anchors to sharpen hierarchy.',
    description: 'Use generous unbroken margins so focal elements command immediate clarity.',
    principles: ['Use generous unbroken margins so focal elements command immediate clarity.'],
    whyItWorks: 'Figure-ground contrast lowers visual noise.',
    useCases: ['Editorial posters', 'Hero title blocks'],
    constraints: ['Works poorly for dense comparative data tables.'],
    commonMistakes: ['Dropping decorative badges into empty zones.'],
    sourceReferenceIds: [],
    relatedPatternIds: [],
    tags: ['composition', 'negative-space'],
    origin: 'illustrative_seed',
    confidence: 0.9,
    status: 'approved',
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  };
}

describe('Knowledge Management & Curation', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      await cleanups.pop()?.();
    }
  });

  it('round-trips KnowledgePattern Markdown frontmatter and sections faithfully', () => {
    const original = makeSeedPattern({ sourceReferenceIds: ['ref_abc123'] });
    const md = serializeKnowledgePatternMarkdown(original);
    const parsed = parseKnowledgePatternMarkdown(md);

    expect(parsed.id).toBe(original.id);
    expect(parsed.name).toBe(original.name);
    expect(parsed.useCases).toEqual(original.useCases);
    expect(parsed.constraints).toEqual(original.constraints);
    expect(parsed.sourceReferenceIds).toEqual(['ref_abc123']);
  });

  it('detects duplicates, extensions, and conflicts deterministically', async () => {
    const ws = await createTempWorkspace();
    cleanups.push(ws.cleanup);

    const seed = makeSeedPattern();
    const seedPath = path.join(ws.paths.knowledgeDir, 'foundations', `${seed.id}.md`);
    await fs.writeFile(seedPath, serializeKnowledgePatternMarkdown(seed), 'utf8');

    const curator = new KnowledgeCurator(ws.paths);
    const existing = await curator.listKnowledge();
    const comparator = new DeterministicKnowledgeComparator();

    const dupResult = await comparator.compare(
      {
        name: 'Deliberate Negative Space',
        category: 'foundations',
        domain: 'graphic-design',
        summary: 'Leaving generous empty space around primary anchors to sharpen hierarchy.',
        principle: 'Use generous unbroken margins so focal elements command immediate clarity.',
        whyItWorks: 'Figure-ground contrast lowers visual noise.',
        useCases: ['Editorial posters'],
        constraints: [],
        commonMistakes: [],
        tags: ['composition', 'negative-space'],
        confidence: 0.85,
      },
      existing,
    );
    expect(dupResult.outcome).toBe('duplicate');

    const conflictResult = await comparator.compare(
      {
        name: 'Always Dense Maximalist Fill',
        category: 'foundations',
        domain: 'graphic-design',
        summary:
          'Fill every pixel with dense layered typography and badges with zero negative space.',
        principle: 'Dense maximal layouts remove open margins entirely.',
        whyItWorks: 'Maximal saturation conveys energy.',
        useCases: ['Flyers'],
        constraints: [],
        commonMistakes: [],
        tags: ['composition', 'negative-space'],
        confidence: 0.7,
      },
      existing,
    );
    expect(conflictResult.outcome).toBe('conflict');
    expect(conflictResult.conflicts.length).toBeGreaterThan(0);
  });

  it('refuses to generate proposals from URL or short notes without substantive analysis', async () => {
    const ws = await createTempWorkspace();
    cleanups.push(ws.cleanup);

    const ingestion = new IngestionService(ws.paths);
    const { reference } = await ingestion.registerUrl({
      url: 'https://example.com/ad',
      notes: 'Nice lighting',
    });

    const curator = new KnowledgeCurator(ws.paths);
    const report = await curator.generateProposalsForReference(reference.id);

    expect(report.insufficientEvidence).toBe(true);
    expect(report.proposals).toHaveLength(0);
  });

  it('applies approved proposals safely, leaves rejected proposals untouched, and blocks invalid paths and external edits', async () => {
    const ws = await createTempWorkspace();
    cleanups.push(ws.cleanup);

    const imgPath = path.join(ws.root, 'ref.png');
    await fs.writeFile(imgPath, createMinimalPngBuffer(500, 700));
    const ingestion = new IngestionService(ws.paths);
    const { reference } = await ingestion.registerLocalFile({ filePath: imgPath });

    const analysisPath = path.join(ws.root, 'analysis.json');
    await fs.writeFile(
      analysisPath,
      JSON.stringify({
        observations: [
          {
            dimension: 'composition',
            statement: 'Asymmetric column grid leaves 50% open right track.',
            evidenceType: 'user_observation',
          },
        ],
        extractedPatterns: [
          {
            name: 'Asymmetric Rail Balance',
            category: 'patterns',
            domain: 'editorial-design',
            summary: 'Counterbalancing off-center mass with an aligned micro-caption rail.',
            principle: 'Anchor typography left while reserving right columns for quiet space.',
            whyItWorks: 'Creates directional tension without losing alignment.',
            useCases: ['Editorial posters'],
            constraints: ['Avoid arbitrary unaligned margins.'],
            commonMistakes: [],
            tags: ['grid', 'asymmetry'],
            confidence: 0.85,
          },
        ],
      }),
    );

    const analysisService = new AnalysisService(ws.paths);
    await analysisService.importAnalysisFromFile(reference.id, analysisPath);

    const curator = new KnowledgeCurator(ws.paths);
    const report = await curator.generateProposalsForReference(reference.id);
    expect(report.proposals).toHaveLength(1);
    const prop = report.proposals[0];
    expect(prop).toBeDefined();
    if (!prop) return;

    // Test rejection leaves knowledge untouched
    const rejected = await curator.rejectProposal(prop.id, { reviewNote: 'Testing reject' });
    expect(rejected.status).toBe('rejected');
    expect(await curator.listKnowledge()).toHaveLength(0);

    // Regenerate and approve safely
    const report2 = await curator.generateProposalsForReference(reference.id);
    const prop2 = report2.proposals[0];
    expect(prop2).toBeDefined();
    if (!prop2) return;

    const applied = await curator.approveProposal(prop2.id, { reviewNote: 'Looks great' });
    expect(applied.status).toBe('applied');
    const knowledge = await curator.listKnowledge();
    expect(knowledge).toHaveLength(1);
    expect(knowledge[0]?.pattern.sourceReferenceIds).toContain(reference.id);

    // Approving a duplicate create proposal fails safely without overwriting existing file
    const report3 = await curator.generateProposalsForReference(reference.id, {
      includeDuplicates: true,
    });
    const dupProp = report3.proposals[0];
    expect(dupProp).toBeDefined();
    if (dupProp) {
      await expect(curator.approveProposal(dupProp.id)).rejects.toBeInstanceOf(ConflictError);
    }

    // Invalid target path (traversal / wrong root) is rejected
    const badProposal: LearningProposal = {
      ...prop2,
      id: createStableId('prop'),
      targetPath: '../outside.md',
      status: 'pending',
    };
    await expect(curator.createProposal(badProposal)).rejects.toBeInstanceOf(PathSecurityError);

    // Direct inbox tamper targeting wrong directory is also caught at approval time
    const tamperedProposal: LearningProposal = {
      ...prop2,
      id: createStableId('prop'),
      targetPath: 'memory/design-dna.yaml',
      status: 'pending',
    };
    await curator.inbox.save(tamperedProposal);
    await expect(curator.approveProposal(tamperedProposal.id)).rejects.toBeInstanceOf(
      PathSecurityError,
    );
  });
});
