import { type CreativeAnalysis, type CreativeReference } from '@aesthra/core';

export interface AnalyzerCapability {
  id: string;
  supportsVisualImages: boolean;
  supportsVideo: boolean;
  supportsMetadataOnly: boolean;
  configured: boolean;
  unavailableReason?: string;
}

export interface AnalyzerProvider {
  readonly id: string;
  readonly version: string;
  getCapabilities(): Promise<AnalyzerCapability>;
  analyze(reference: CreativeReference, workspaceRoot: string): Promise<CreativeAnalysis>;
}

export interface VisionProviderStatus {
  configured: boolean;
  providerId?: string;
  reason: string;
}

export function getVisionProviderStatus(): VisionProviderStatus {
  const configuredProvider = process.env['AESTHRA_VISION_PROVIDER']?.trim();
  if (!configuredProvider) {
    return {
      configured: false,
      reason:
        'No vision-capable AI provider is configured (AESTHRA_VISION_PROVIDER is unset). Automated visual inspection is unavailable; use --import <analysis.json> or the reference-analyzer Skill.',
    };
  }

  return {
    configured: false,
    providerId: configuredProvider,
    reason: `Vision provider "${configuredProvider}" is named in AESTHRA_VISION_PROVIDER, but no live vision adapter is registered in this MVP build. Use --import <analysis.json> instead.`,
  };
}

