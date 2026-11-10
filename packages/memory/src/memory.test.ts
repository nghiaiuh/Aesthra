import { afterEach, describe, expect, it } from 'vitest';
import { MemoryService } from '@aesthra/memory';
import { createTempWorkspace } from '../../../tests/fixtures/helpers.js';

describe('MemoryService', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      await cleanups.pop()?.();
    }
  });

  it('distinguishes explicit user feedback from tentative inferred preferences and logs provenance', async () => {
    const ws = await createTempWorkspace();
    cleanups.push(ws.cleanup);

    const memory = new MemoryService(ws.paths);
    const explicitFb = await memory.recordFeedback({
      source: 'explicit_user',
      referenceId: 'ref_123',
      category: 'lighting',
      statement: 'Prefer soft side-lit shadows over flat front flash.',
      polarity: 'prefer',
    });

    const inferredFb = await memory.recordFeedback({
      source: 'agent_inferred',
      referenceId: 'ref_123',
      category: 'color',
      statement: 'Possibly prefers muted earth tones.',
      polarity: 'prefer',
    });

    // Recording feedback alone must NOT mutate Design DNA automatically
    const before = await memory.getProfile();
    expect(before.preferences).toHaveLength(0);
    expect(before.recentFeedback).toHaveLength(2);

    const explicitPref = memory.createCandidatePreference({
      category: 'lighting',
      preference: explicitFb.statement,
      polarity: 'prefer',
      source: 'explicit_user',
      sourceFeedbackIds: [explicitFb.id],
      evidence: ['User stated directly during review'],
    });
    expect(explicitPref.status).toBe('explicit');

    const tentativePref = memory.createCandidatePreference({
      category: 'color',
      preference: inferredFb.statement,
      polarity: 'prefer',
      source: 'agent_inferred',
      sourceFeedbackIds: [inferredFb.id],
      evidence: ['Inferred from one reference'],
    });
    expect(tentativePref.status).toBe('tentative');

    await memory.applyApprovedPreference(explicitPref);
    await memory.applyApprovedPreference(tentativePref);

    const after = await memory.getProfile();
    expect(after.designDna.categories.lighting.explicit).toHaveLength(1);
    expect(after.designDna.categories.color.tentative).toHaveLength(1);
    expect(after.designDna.categories.color.explicit).toHaveLength(0);
    expect(after.designDna.categories.lighting.explicit[0]?.sourceFeedbackIds).toContain(
      explicitFb.id,
    );

    // Rejected preference status removes/excludes preference from active buckets
    await memory.applyApprovedPreference({
      ...tentativePref,
      status: 'rejected',
    });
    const afterReject = await memory.getProfile();
    expect(afterReject.designDna.categories.color.tentative).toHaveLength(0);
  });
});

