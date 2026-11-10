import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ValidationError } from '@aesthra/core';
import { IngestionService } from '@aesthra/ingestion';
import { createMinimalPngBuffer, createTempWorkspace } from '../../../tests/fixtures/helpers.js';

describe('IngestionService', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      await cleanups.pop()?.();
    }
  });

  it('registers a valid local PNG reference with technical metadata and content hash', async () => {
    const ws = await createTempWorkspace();
    cleanups.push(ws.cleanup);

    const imgPath = path.join(ws.root, 'poster.png');
    await fs.writeFile(imgPath, createMinimalPngBuffer(640, 480));

    const ingestion = new IngestionService(ws.paths);
    const result = await ingestion.registerLocalFile({
      filePath: imgPath,
      sourceType: 'poster',
      tags: ['Editorial', 'Minimal'],
      notes: 'Clean negative space',
    });

    expect(result.duplicate).toBe(false);
    expect(result.reference.id).toMatch(/^ref_/);
    expect(result.reference.status).toBe('registered');
    expect(result.reference.sourceType).toBe('poster');
    expect(result.reference.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(result.reference.technicalMetadata?.width).toBe(640);
    expect(result.reference.technicalMetadata?.height).toBe(480);
    expect(result.reference.tags).toEqual(['editorial', 'minimal']);
    expect(result.reference.userNotes[0]?.text).toBe('Clean negative space');
  });

  it('rejects missing files, directories, empty files, and unsupported extensions', async () => {
    const ws = await createTempWorkspace();
    cleanups.push(ws.cleanup);

    const ingestion = new IngestionService(ws.paths);

    await expect(
      ingestion.registerLocalFile({ filePath: path.join(ws.root, 'does-not-exist.png') }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(ingestion.registerLocalFile({ filePath: ws.root })).rejects.toBeInstanceOf(
      ValidationError,
    );

    const emptyPng = path.join(ws.root, 'empty.png');
    await fs.writeFile(emptyPng, Buffer.alloc(0));
    await expect(ingestion.registerLocalFile({ filePath: emptyPng })).rejects.toBeInstanceOf(
      ValidationError,
    );

    const exeFile = path.join(ws.root, 'payload.exe');
    await fs.writeFile(exeFile, 'MZ');
    await expect(ingestion.registerLocalFile({ filePath: exeFile })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('deduplicates identical file content hashes but does not merge distinct files sharing a title', async () => {
    const ws = await createTempWorkspace();
    cleanups.push(ws.cleanup);

    const imgA = path.join(ws.root, 'a.png');
    const imgB = path.join(ws.root, 'b.png');
    const imgC = path.join(ws.root, 'c.png');
    const buf1 = createMinimalPngBuffer(320, 240);
    const buf2 = createMinimalPngBuffer(400, 300);

    await fs.writeFile(imgA, buf1);
    await fs.writeFile(imgB, buf1);
    await fs.writeFile(imgC, buf2);

    const ingestion = new IngestionService(ws.paths);
    const first = await ingestion.registerLocalFile({ filePath: imgA, title: 'Shared Title' });
    const dup = await ingestion.registerLocalFile({ filePath: imgB, title: 'Different Title' });
    const distinct = await ingestion.registerLocalFile({ filePath: imgC, title: 'Shared Title' });

    expect(first.duplicate).toBe(false);
    expect(dup.duplicate).toBe(true);
    expect(dup.matchedBy).toBe('contentHash');
    expect(dup.reference.id).toBe(first.reference.id);

    expect(distinct.duplicate).toBe(false);
    expect(distinct.reference.id).not.toBe(first.reference.id);
  });

  it('registers valid URLs with canonical deduplication and blocks SSRF targets', async () => {
    const ws = await createTempWorkspace();
    cleanups.push(ws.cleanup);

    const ingestion = new IngestionService(ws.paths);

    const first = await ingestion.registerUrl({
      url: 'https://Example.COM/work/film/?utm_source=social#top',
      notes: 'Interesting pacing',
    });
    const dup = await ingestion.registerUrl({
      url: 'https://example.com/work/film',
    });

    expect(first.duplicate).toBe(false);
    expect(first.reference.canonicalUrl).toBe('https://example.com/work/film');
    expect(dup.duplicate).toBe(true);
    expect(dup.matchedBy).toBe('canonicalUrl');

    for (const badUrl of [
      'http://127.0.0.1/admin',
      'http://localhost:3000/secret',
      'http://169.254.169.254/latest/meta-data',
      'http://192.168.1.10/asset.png',
      'file:///etc/passwd',
      'https://user:pass@example.com/ref',
    ]) {
      await expect(ingestion.registerUrl({ url: badUrl })).rejects.toBeInstanceOf(ValidationError);
    }
  });
});

