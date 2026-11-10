import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PathSecurityError, resolveSafeTargetPath, slugify } from '@aesthra/core';
import { createTempWorkspace } from '../../../tests/fixtures/helpers.js';

describe('Core utilities and path safety', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      await cleanups.pop()?.();
    }
  });

  it('allows valid workspace-relative paths inside allowed prefixes and blocks traversal or absolute paths', async () => {
    const ws = await createTempWorkspace();
    cleanups.push(ws.cleanup);

    const safe = await resolveSafeTargetPath(ws.root, 'knowledge/patterns/example.md', [
      'knowledge',
    ]);
    expect(safe).toContain(path.join('knowledge', 'patterns', 'example.md'));

    await expect(
      resolveSafeTargetPath(ws.root, '../escape.md', ['knowledge']),
    ).rejects.toBeInstanceOf(PathSecurityError);

    await expect(
      resolveSafeTargetPath(ws.root, '/etc/passwd', ['knowledge']),
    ).rejects.toBeInstanceOf(PathSecurityError);

    await expect(
      resolveSafeTargetPath(ws.root, 'memory/design-dna.yaml', ['knowledge']),
    ).rejects.toBeInstanceOf(PathSecurityError);
  });

  it('normalizes slugs deterministically', () => {
    expect(slugify('Deliberate Negative Space!')).toBe('deliberate-negative-space');
    expect(slugify('  Slow   Camera — Reveal  ')).toBe('slow-camera-reveal');
  });
});
