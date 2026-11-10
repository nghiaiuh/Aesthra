import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { type KnowledgePattern, nowIso } from '@aesthra/core';
import { serializeKnowledgePatternMarkdown } from '@aesthra/knowledge';
import { RetrievalService } from '@aesthra/retrieval';
import { createTempWorkspace } from '../../../tests/fixtures/helpers.js';

function makePattern(
  partial: Partial<KnowledgePattern> & { id: string; name: string },
): KnowledgePattern {
  const ts = nowIso();
  return {
    category: 'cinematic',
    domain: 'cinematic',
    summary: `${partial.name} summary`,
    description: `${partial.name} description`,
    principles: [`${partial.name} principle`],
    whyItWorks: 'Creates clarity.',
    useCases: ['Film reveal'],
    constraints: [],
    commonMistakes: [],
    sourceReferenceIds: [],
    relatedPatternIds: [],
    tags: ['cinematic'],
    origin: 'illustrative_seed',
    confidence: 0.85,
    status: 'approved',
    createdAt: ts,
    updatedAt: ts,
    ...partial,
  };
}

describe('RetrievalService', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      await cleanups.pop()?.();
    }
  });

  it('retrieves only approved knowledge entries matching query, domain, and tags', async () => {
    const ws = await createTempWorkspace();
    cleanups.push(ws.cleanup);

    const approved = makePattern({
      id: 'atmospheric-backlight-haze',
      name: 'Atmospheric Backlight Haze',
      tags: ['lighting', 'atmosphere'],
      summary: 'Separates silhouette edges using soft volumetric backlight.',
    });
    const draft = makePattern({
      id: 'unapproved-draft-lighting',
      name: 'Unapproved Draft Lighting',
      tags: ['lighting'],
      status: 'draft',
    });

    await fs.writeFile(
      path.join(ws.paths.knowledgeDir, 'cinematic', `${approved.id}.md`),
      serializeKnowledgePatternMarkdown(approved),
      'utf8',
    );
    await fs.writeFile(
      path.join(ws.paths.knowledgeDir, 'cinematic', `${draft.id}.md`),
      serializeKnowledgePatternMarkdown(draft),
      'utf8',
    );

    const retrieval = new RetrievalService(ws.paths);
    const result = await retrieval.search({
      query: 'lighting silhouette',
      tag: 'lighting',
    });

    expect(result.retrievalMode).toBe('local_keyword');
    expect(result.items.map((i) => i.id)).toEqual(['atmospheric-backlight-haze']);
  });
});
