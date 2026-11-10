import fs from 'node:fs/promises';
import path from 'node:path';
import {
  type CreativeAnalysis,
  type CreativeReference,
  ExternalProviderUnavailableError,
  ValidationError,
  type WorkspacePaths,
} from '@aesthra/core';
import { ReferenceCatalogStore } from '@aesthra/ingestion';
import { importStructuredAnalysis } from './importer.js';
import { TechnicalMetadataAnalyzer } from './metadata-analyzer.js';
import { getVisionProviderStatus } from './provider.js';
import { AnalysisStore } from './store.js';

export interface AnalyzeReferenceResult {
  reference: CreativeReference;
  analysis: CreativeAnalysis;
  visionAvailable: boolean;
  message: string;
}

export class AnalysisService {
  public readonly catalog: ReferenceCatalogStore;
  public readonly store: AnalysisStore;
  private readonly metadataAnalyzer: TechnicalMetadataAnalyzer;

  constructor(private readonly paths: WorkspacePaths) {
    this.catalog = new ReferenceCatalogStore(paths);
    this.store = new AnalysisStore(paths);
    this.metadataAnalyzer = new TechnicalMetadataAnalyzer();
  }

  async analyzeReference(
    referenceId: string,
    options?: { requireVision?: boolean },
  ): Promise<AnalyzeReferenceResult> {
    const reference = await this.catalog.getById(referenceId);
    const visionStatus = getVisionProviderStatus();

    if (options?.requireVision && !visionStatus.configured) {
      throw new ExternalProviderUnavailableError(visionStatus.reason, {
        referenceId,
        providerId: visionStatus.providerId ?? null,
      });
    }

    let analysis: CreativeAnalysis;
    try {
      analysis = await this.metadataAnalyzer.analyze(reference, this.paths.root);
    } catch (error) {
      const failedRef: CreativeReference = {
        ...reference,
        status: 'analysis_failed',
      };
      await this.catalog.save(failedRef);
      throw error;
    }

    await this.store.save(analysis);

    const nextStatus = reference.status === 'analyzed' ? 'analyzed' : ('pending_analysis' as const);

    const updatedRef: CreativeReference = {
      ...reference,
      status: nextStatus,
      analysisIds: [...reference.analysisIds, analysis.id],
    };
    await this.catalog.save(updatedRef);

    const message = reference.localPath
      ? `Technical metadata inspection complete (${analysis.observations.length} observation(s)). ${visionStatus.reason}`
      : `Reference "${reference.id}" has no local media file and remote content was not fetched. ${visionStatus.reason}`;

    return {
      reference: updatedRef,
      analysis,
      visionAvailable: false,
      message,
    };
  }

  async importAnalysisFromFile(
    referenceId: string,
    analysisJsonPath: string,
  ): Promise<AnalyzeReferenceResult> {
    const reference = await this.catalog.getById(referenceId);
    const resolvedJson = path.resolve(this.paths.root, analysisJsonPath);

    let rawText: string;
    try {
      rawText = await fs.readFile(resolvedJson, 'utf8');
    } catch (error) {
      throw new ValidationError(
        `Cannot read structured analysis file "${analysisJsonPath}".`,
        { analysisJsonPath },
        error,
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch (error) {
      throw new ValidationError(
        `Invalid JSON in analysis file "${analysisJsonPath}".`,
        { analysisJsonPath },
        error,
      );
    }

    const analysis = importStructuredAnalysis(reference, parsedJson);
    await this.store.save(analysis);

    const updatedRef: CreativeReference = {
      ...reference,
      status: 'analyzed',
      analysisIds: [...reference.analysisIds, analysis.id],
    };
    await this.catalog.save(updatedRef);

    return {
      reference: updatedRef,
      analysis,
      visionAvailable: false,
      message: `Imported structured analysis "${analysis.id}" (${analysis.observations.length} observation(s), ${analysis.extractedPatterns.length} candidate pattern(s)).`,
    };
  }
}
