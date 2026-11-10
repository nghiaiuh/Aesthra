import {
  type CandidatePatternDraft,
  type CreativeAnalysis,
  type CreativeReference,
  type ProposalEvidence,
} from '@aesthra/core';

export interface ExtractedCandidate {
  draft: CandidatePatternDraft;
  analysisId: string;
  evidence: ProposalEvidence[];
}

export interface PatternExtractionResult {
  candidates: ExtractedCandidate[];
  insufficientEvidence: boolean;
  reason?: string;
}

export function extractCandidatePatterns(
  reference: CreativeReference,
  analyses: CreativeAnalysis[],
): PatternExtractionResult {
  const substantiveAnalyses = analyses.filter(
    (analysis) =>
      analysis.analysisKind !== 'technical_metadata' &&
      (analysis.extractedPatterns.length > 0 || analysis.observations.length > 0),
  );

  if (substantiveAnalyses.length === 0) {
    const hasOnlyNotes = reference.userNotes.length > 0;
    const reason = hasOnlyNotes
      ? `Reference "${reference.id}" only has user notes and/or technical file metadata, with no structured visual analysis or extracted patterns. Run "aesthra analyze ${reference.id} --import <analysis.json>" first rather than inferring visual principles from short notes.`
      : `Reference "${reference.id}" lacks a visual or structured analysis. Aesthetic principles cannot be generated from a URL or file hash alone.`;

    return {
      candidates: [],
      insufficientEvidence: true,
      reason,
    };
  }

  const candidates: ExtractedCandidate[] = [];

  for (const analysis of substantiveAnalyses) {
    if (analysis.extractedPatterns.length === 0) {
      continue;
    }

    const obsEvidence: ProposalEvidence[] = analysis.observations.slice(0, 4).map((obs) => ({
      type: 'analysis_observation',
      id: obs.id,
      summary: `[${obs.dimension} / ${obs.evidenceType}] ${obs.statement}`,
    }));

    const noteEvidence: ProposalEvidence[] = reference.userNotes.slice(0, 2).map((note) => ({
      type: 'user_note',
      id: note.id,
      summary: note.text,
    }));

    const evidence: ProposalEvidence[] = [
      ...obsEvidence,
      ...noteEvidence,
      ...(obsEvidence.length === 0 && noteEvidence.length === 0
        ? [
            {
              type: 'analysis_observation' as const,
              id: analysis.id,
              summary: `Extracted from structured analysis ${analysis.id} (${analysis.analyzer}).`,
            },
          ]
        : []),
    ];

    for (const draft of analysis.extractedPatterns) {
      candidates.push({
        draft,
        analysisId: analysis.id,
        evidence,
      });
    }
  }

  if (candidates.length === 0) {
    return {
      candidates: [],
      insufficientEvidence: true,
      reason: `Analysis exists for reference "${reference.id}", but no reusable candidate patterns were identified with sufficient evidence.`,
    };
  }

  return {
    candidates,
    insufficientEvidence: false,
  };
}
