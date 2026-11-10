import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AnalysisService } from '@aesthra/analysis';
import { ExternalProviderUnavailableError, ValidationError } from '@aesthra/core';
import { IngestionService } from '@aesthra/ingestion';
import { createMinimalPngBuffer, createTempWorkspace } from '../../../tests/fixtures/helpers.js';

describe('AnalysisService', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      await cleanups.pop()?.();
    }
  });

  it('extracts honest technical metadata without fabricating visual claims when no vision provider exists', async () => {
    const ws = await createTempWorkspace();
    cleanups.push(ws.cleanup);

    const imgPath = path.join(ws.root, 'frame.png');
    await fs.writeFile(imgPath, createMinimalPngBuffer(800, 600));

    const ingestion = new IngestionService(ws.paths);
    const { reference } = await ingestion.registerLocalFile({ filePath: imgPath });

    const analysisService = new AnalysisService(ws.paths);
    const result = await analysisService.analyzeReference(reference.id);

    expect(result.visionAvailable).toBe(false);
    expect(result.reference.status).toBe('pending_analysis');
    expect(result.analysis.analysisKind).toBe('technical_metadata');
    expect(result.analysis.observations.every((o) => o.evidenceType === 'technical_metadata')).toBe(
      true,
    );
    expect(result.analysis.interpretations).toHaveLength(0);
    expect(result.analysis.extractedPatterns).toHaveLength(0);
    expect(result.analysis.uncertainty.some((u) => /vision/i.test(u))).toBe(true);

    await expect(
      analysisService.analyzeReference(reference.id, { requireVision: true }),
    ).rejects.toBeInstanceOf(ExternalProviderUnavailableError);
  });

  it('reports unavailable media honestly for URL-only references and marks missing local files as failed', async () => {
    const ws = await createTempWorkspace();
    cleanups.push(ws.cleanup);

    const ingestion = new IngestionService(ws.paths);
    const analysisService = new AnalysisService(ws.paths);

    const urlRef = await ingestion.registerUrl({ url: 'https://example.com/poster' });
    const urlResult = await analysisService.analyzeReference(urlRef.reference.id);
    expect(urlResult.analysis.sourceEvidence.mediaAccessible).toBe(false);
    expect(urlResult.analysis.confidence).toBe(0);
    expect(urlResult.analysis.observations).toHaveLength(0);

    const imgPath = path.join(ws.root, 'ephemeral.png');
    await fs.writeFile(imgPath, createMinimalPngBuffer(200, 200));
    const fileRef = await ingestion.registerLocalFile({ filePath: imgPath });
    await fs.rm(imgPath);

    await expect(analysisService.analyzeReference(fileRef.reference.id)).rejects.toBeInstanceOf(
      ValidationError,
    );
    const reloaded = await ingestion.catalog.getById(fileRef.reference.id);
    expect(reloaded.status).toBe('analysis_failed');
  });

  it('imports valid structured analyses preserving observations vs interpretations and rejects invalid inputs', async () => {
    const ws = await createTempWorkspace();
    cleanups.push(ws.cleanup);

    const imgPath = path.join(ws.root, 'poster.png');
    await fs.writeFile(imgPath, createMinimalPngBuffer(600, 800));

    const ingestion = new IngestionService(ws.paths);
    const { reference } = await ingestion.registerLocalFile({ filePath: imgPath });

    const validJsonPath = path.join(ws.root, 'valid-analysis.json');
    await fs.writeFile(
      validJsonPath,
      JSON.stringify({
        observations: [
          {
            dimension: 'composition',
            statement: 'Primary focal mass sits in lower left third.',
            evidenceType: 'user_observation',
          },
        ],
        interpretations: [
          {
            dimension: 'emotionalTone',
            statement: 'Conveys grounded stillness.',
            rationale: 'Unbroken upper dark negative field offsets bottom weight.',
            evidenceType: 'user_interpretation',
          },
        ],
        uncertainty: ['Font file unavailable.'],
        extractedPatterns: [],
      }),
    );

    const analysisService = new AnalysisService(ws.paths);
    const imported = await analysisService.importAnalysisFromFile(reference.id, validJsonPath);
    expect(imported.reference.status).toBe('analyzed');
    expect(imported.analysis.observations[0]?.evidenceType).toBe('user_observation');
    expect(imported.analysis.interpretations[0]?.evidenceType).toBe('user_interpretation');

    const badJsonPath = path.join(ws.root, 'bad-analysis.json');
    await fs.writeFile(
      badJsonPath,
      JSON.stringify({
        referenceId: 'ref_wrong_id',
        observations: [{ dimension: 'invalid_dim', statement: 'bad' }],
      }),
    );

    await expect(
      analysisService.importAnalysisFromFile(reference.id, badJsonPath),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

