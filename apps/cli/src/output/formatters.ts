import {
  type CreativeAnalysis,
  type CreativeReference,
  type LearningProposal,
} from '@aesthra/core';
import { type ProfileSnapshot } from '@aesthra/memory';
import { type RetrievalResponse } from '@aesthra/retrieval';

export function formatReferenceSummary(ref: CreativeReference): string {
  const lines = [
    `Reference: ${ref.id}`,
    `  Title:       ${ref.title}`,
    `  Type:        ${ref.sourceType}`,
    `  Status:      ${ref.status}`,
    ...(ref.localPath ? [`  Local path:  ${ref.localPath}`] : []),
    ...(ref.sourceUrl ? [`  Source URL:  ${ref.sourceUrl}`] : []),
    ...(ref.contentHash ? [`  Hash:        ${ref.contentHash}`] : []),
    ...(ref.technicalMetadata?.width && ref.technicalMetadata.height
      ? [`  Dimensions:  ${ref.technicalMetadata.width}x${ref.technicalMetadata.height}`]
      : []),
    ...(ref.tags.length > 0 ? [`  Tags:        ${ref.tags.join(', ')}`] : []),
    ...(ref.userNotes.length > 0
      ? [`  Notes:       ${ref.userNotes.map((n) => n.text).join(' | ')}`]
      : []),
  ];
  return lines.join('\n');
}

export function formatAnalysisSummary(analysis: CreativeAnalysis): string {
  const lines = [
    `Analysis: ${analysis.id} (${analysis.analysisKind})`,
    `  Reference:   ${analysis.referenceId}`,
    `  Analyzer:    ${analysis.analyzer} v${analysis.analyzerVersion}`,
    `  Confidence:  ${analysis.confidence.toFixed(2)}`,
    `  Media access: ${analysis.sourceEvidence.mediaAccessible ? 'yes' : 'no'} (${analysis.sourceEvidence.inspectedSourceType})`,
  ];

  if (analysis.observations.length > 0) {
    lines.push('  Observations:');
    for (const obs of analysis.observations) {
      lines.push(`    - [${obs.dimension} | ${obs.evidenceType}] ${obs.statement}`);
    }
  }

  if (analysis.interpretations.length > 0) {
    lines.push('  Interpretations:');
    for (const interp of analysis.interpretations) {
      lines.push(`    - [${interp.dimension} | ${interp.evidenceType}] ${interp.statement}`);
    }
  }

  if (analysis.uncertainty.length > 0) {
    lines.push('  Uncertainty / Limitations:');
    for (const item of analysis.uncertainty) {
      lines.push(`    - ${item}`);
    }
  }

  if (analysis.extractedPatterns.length > 0) {
    lines.push(`  Candidate Patterns (${analysis.extractedPatterns.length}):`);
    for (const pat of analysis.extractedPatterns) {
      lines.push(
        `    - ${pat.name} [${pat.category}/${pat.domain}] (${pat.confidence.toFixed(2)})`,
      );
    }
  }

  return lines.join('\n');
}

export function formatProposalRow(p: LearningProposal): string {
  const conflictLabel = p.conflicts.length > 0 ? ` | conflicts=${p.conflicts.length}` : '';
  return `${p.id}  [${p.status}]  ${p.proposalType} (${p.action}, ${p.comparisonOutcome}${conflictLabel}) -> ${p.targetPath}  [ref=${p.referenceId}]`;
}

export function formatProposalDetail(p: LearningProposal): string {
  const lines = [
    `Proposal: ${p.id}`,
    `  Status:      ${p.status}`,
    `  Type:        ${p.proposalType} (${p.action})`,
    `  Target Path: ${p.targetPath}`,
    `  Reference:   ${p.referenceId}`,
    ...(p.analysisId ? [`  Analysis:    ${p.analysisId}`] : []),
    `  Comparison:  ${p.comparisonOutcome}`,
    `  Confidence:  ${p.confidence.toFixed(2)}`,
    `  Created:     ${p.createdAt}`,
    ...(p.reviewedAt ? [`  Reviewed:    ${p.reviewedAt}`] : []),
    ...(p.appliedAt ? [`  Applied:     ${p.appliedAt}`] : []),
    ...(p.reviewNote ? [`  Review Note: ${p.reviewNote}`] : []),
    `  Rationale:   ${p.rationale}`,
    '  Evidence:',
    ...p.evidence.map((ev) => `    - [${ev.type}${ev.id ? `:${ev.id}` : ''}] ${ev.summary}`),
  ];

  if (p.conflicts.length > 0) {
    lines.push('  Conflicts:');
    for (const c of p.conflicts) {
      lines.push(`    - [${c.severity}] ${c.targetId} (${c.targetPath}): ${c.reason}`);
    }
  }

  lines.push('  Proposed Change:');
  if (p.proposedChange.kind === 'knowledge_pattern') {
    lines.push('--- Preview ---');
    lines.push(p.proposedChange.markdownPreview.trimEnd());
    lines.push('--- End Preview ---');
  } else if (p.proposedChange.kind === 'preference') {
    const pref = p.proposedChange.preference;
    lines.push(
      `    Preference [${pref.category} / ${pref.polarity} / ${pref.status}]: ${pref.preference}`,
    );
  } else {
    lines.push(`    Skill (${p.proposedChange.skillName}): ${p.proposedChange.summary}`);
  }

  return lines.join('\n');
}

export function formatSearchResults(res: RetrievalResponse): string {
  const lines = [`Search (${res.retrievalMode}): "${res.query}" — ${res.totalMatched} match(es)`];
  if (res.items.length === 0) {
    lines.push('  No matching entries found.');
    return lines.join('\n');
  }

  for (const item of res.items) {
    lines.push(`  - [${item.kind}] ${item.title} (score=${item.score}, ${item.domainOrCategory})`);
    lines.push(`    Path: ${item.path}`);
    lines.push(`    Summary: ${item.summary}`);
    if (item.provenance.length > 0) {
      lines.push(`    Provenance: ${item.provenance.join(', ')}`);
    }
  }
  return lines.join('\n');
}

export function formatProfileSnapshot(snapshot: ProfileSnapshot): string {
  const lines = [
    `Personal Design DNA (owner: ${snapshot.designDna.owner})`,
    `  Updated: ${snapshot.designDna.updatedAt}`,
    `  Active preferences: ${snapshot.preferences.length}`,
  ];

  if (snapshot.preferences.length === 0) {
    lines.push(
      '  No personal preferences recorded yet. General creative knowledge lives in knowledge/.',
    );
    lines.push(
      '  Use "pnpm brain propose <ref-id> --prefer <statement> --category <cat>" to propose a taste preference for review.',
    );
  } else {
    for (const pref of snapshot.preferences) {
      lines.push(
        `  - [${pref.category} | ${pref.bucket} | ${pref.polarity} | strength=${pref.strength.toFixed(2)}] ${pref.preference}`,
      );
    }
  }

  lines.push(`  Logged feedback events: ${snapshot.recentFeedback.length}`);
  lines.push(`  Logged review decisions: ${snapshot.recentDecisions.length}`);
  return lines.join('\n');
}
