import {
  AnalysisImportInputSchema,
  type CreativeAnalysis,
  CreativeAnalysisSchema,
  type CreativeReference,
  ValidationError,
  createStableId,
  nowIso,
} from '@aesthra/core';

export function importStructuredAnalysis(
  reference: CreativeReference,
  rawInput: unknown,
): CreativeAnalysis {
  const parsed = AnalysisImportInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError(
      `Invalid structured analysis format: ${parsed.error.message}`,
      { issues: parsed.error.issues },
      parsed.error,
    );
  }

  const input = parsed.data;
  if (input.referenceId && input.referenceId !== reference.id) {
    throw new ValidationError(
      `Imported analysis specifies referenceId "${input.referenceId}", which does not match target reference "${reference.id}".`,
      { importReferenceId: input.referenceId, targetReferenceId: reference.id },
    );
  }

  const observations = input.observations.map((obs, index) => ({
    id: obs.id ?? `obs_${index + 1}`,
    dimension: obs.dimension,
    statement: obs.statement,
    evidenceType: obs.evidenceType,
    ...(obs.evidenceRef ? { evidenceRef: obs.evidenceRef } : {}),
  }));

  const interpretations = input.interpretations.map((interp, index) => ({
    id: interp.id ?? `int_${index + 1}`,
    dimension: interp.dimension,
    statement: interp.statement,
    rationale: interp.rationale,
    evidenceType: interp.evidenceType,
  }));

  const defaultEvidence = {
    mediaAccessible: Boolean(reference.localPath),
    inspectedSourceType: 'structured_json_import' as const,
    ...(reference.localPath
      ? { sourcePathOrUrl: reference.localPath }
      : reference.sourceUrl
        ? { sourcePathOrUrl: reference.sourceUrl }
        : {}),
    ...(reference.contentHash ? { contentHash: reference.contentHash } : {}),
    limitations:
      observations.length === 0
        ? ['Imported structured analysis contains no direct observations.']
        : [],
  };

  const analysis: CreativeAnalysis = CreativeAnalysisSchema.parse({
    id: createStableId('ana'),
    referenceId: reference.id,
    analyzer: input.analyzer,
    analyzerVersion: input.analyzerVersion,
    analysisKind: 'manual_structured',
    analyzedAt: nowIso(),
    observations,
    interpretations,
    confidence: input.confidence,
    uncertainty: input.uncertainty,
    extractedPatterns: input.extractedPatterns,
    sourceEvidence: input.sourceEvidence ?? defaultEvidence,
  });

  return analysis;
}

