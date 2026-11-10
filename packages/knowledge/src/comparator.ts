import {
  type CandidatePatternDraft,
  type ComparisonOutcome,
  type ProposalConflict,
  slugify,
} from '@aesthra/core';
import { type StoredKnowledgeEntry } from './markdown.js';

export interface KnowledgeComparisonResult {
  outcome: ComparisonOutcome;
  matchedEntry?: StoredKnowledgeEntry;
  similarityScore: number;
  conflicts: ProposalConflict[];
  rationale: string;
}

export interface KnowledgeComparator {
  compare(
    candidate: CandidatePatternDraft,
    existing: StoredKnowledgeEntry[],
  ): Promise<KnowledgeComparisonResult>;
}

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'into',
  'when',
  'your',
  'about',
  'using',
  'used',
  'over',
  'under',
  'more',
  'than',
  'avoid',
  'keep',
  'make',
  'have',
  'very',
]);

const OPPOSITION_PAIRS: Array<[string, string]> = [
  ['generous', 'dense'],
  ['minimal', 'maximal'],
  ['slow', 'rapid'],
  ['slow', 'fast'],
  ['asymmetric', 'centered'],
  ['asymmetric', 'symmetrical'],
  ['quiet', 'loud'],
  ['avoid', 'always'],
  ['never', 'always'],
  ['low-key', 'high-key'],
  ['subtle', 'aggressive'],
  ['static', 'kinetic'],
];

function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  return new Set(words);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) {
      intersection++;
    }
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function detectOpposition(
  candidate: CandidatePatternDraft,
  existing: StoredKnowledgeEntry,
): string | undefined {
  const candidateTokens = tokenize(`${candidate.name} ${candidate.summary} ${candidate.principle}`);
  const existingTokens = tokenize(
    `${existing.pattern.name} ${existing.pattern.summary} ${existing.pattern.description}`,
  );

  for (const [left, right] of OPPOSITION_PAIRS) {
    if (
      (candidateTokens.has(left) && existingTokens.has(right)) ||
      (candidateTokens.has(right) && existingTokens.has(left))
    ) {
      return `Opposing guidance detected ("${left}" vs "${right}") relative to "${existing.pattern.name}".`;
    }
  }

  for (const constraint of existing.pattern.constraints) {
    const constraintTokens = tokenize(constraint);
    const overlap = jaccardSimilarity(candidateTokens, constraintTokens);
    if (overlap >= 0.35 && /\b(avoid|never|do not|works poorly)\b/i.test(constraint)) {
      return `Candidate principle overlaps with an existing constraint on "${existing.pattern.name}": "${constraint}".`;
    }
  }

  return undefined;
}

export class DeterministicKnowledgeComparator implements KnowledgeComparator {
  compare(
    candidate: CandidatePatternDraft,
    existing: StoredKnowledgeEntry[],
  ): Promise<KnowledgeComparisonResult> {
    if (existing.length === 0) {
      return Promise.resolve({
        outcome: 'new',
        similarityScore: 0,
        conflicts: [],
        rationale:
          'No existing knowledge patterns present in workspace; treating candidate as new.',
      });
    }

    const candidateSlug = slugify(candidate.name);
    const candidateTokens = tokenize(
      [
        candidate.name,
        candidate.summary,
        candidate.principle,
        ...candidate.tags,
        ...candidate.useCases,
      ].join(' '),
    );

    let bestMatch: StoredKnowledgeEntry | undefined;
    let bestScore = 0;

    for (const entry of existing) {
      const entryTokens = tokenize(
        [
          entry.pattern.name,
          entry.pattern.summary,
          entry.pattern.description,
          ...entry.pattern.tags,
          ...entry.pattern.useCases,
        ].join(' '),
      );

      let score = jaccardSimilarity(candidateTokens, entryTokens);
      if (entry.pattern.id === candidateSlug) {
        score = Math.max(score, 0.92);
      } else if (entry.pattern.name.toLowerCase() === candidate.name.toLowerCase()) {
        score = Math.max(score, 0.9);
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = entry;
      }
    }

    if (!bestMatch) {
      return Promise.resolve({
        outcome: 'new',
        similarityScore: 0,
        conflicts: [],
        rationale: 'Candidate pattern has no substantial overlap with existing knowledge.',
      });
    }

    const oppositionReason = detectOpposition(candidate, bestMatch);
    const sameDomainOrTags =
      candidate.domain === bestMatch.pattern.domain ||
      candidate.tags.some((tag) => bestMatch.pattern.tags.includes(tag));

    if (oppositionReason && (bestScore >= 0.2 || sameDomainOrTags)) {
      return Promise.resolve({
        outcome: 'conflict',
        matchedEntry: bestMatch,
        similarityScore: bestScore,
        conflicts: [
          {
            targetId: bestMatch.pattern.id,
            targetPath: bestMatch.relativePath,
            reason: oppositionReason,
            severity: 'high',
          },
        ],
        rationale: oppositionReason,
      });
    }

    const isExactIdOrName =
      bestMatch.pattern.id === candidateSlug ||
      bestMatch.pattern.name.toLowerCase() === candidate.name.toLowerCase();

    const existingUseCaseSet = new Set(bestMatch.pattern.useCases.map((u) => u.toLowerCase()));
    const addsNovelUseCases = candidate.useCases.some(
      (u) => !existingUseCaseSet.has(u.toLowerCase()),
    );

    if ((isExactIdOrName && !addsNovelUseCases) || bestScore >= 0.72) {
      return Promise.resolve({
        outcome: 'duplicate',
        matchedEntry: bestMatch,
        similarityScore: bestScore,
        conflicts: [
          {
            targetId: bestMatch.pattern.id,
            targetPath: bestMatch.relativePath,
            reason: `Closely duplicates existing pattern "${bestMatch.pattern.name}" (${bestMatch.relativePath}).`,
            severity: 'medium',
          },
        ],
        rationale: `Candidate closely matches existing knowledge pattern "${bestMatch.pattern.name}" (similarity ${bestScore.toFixed(2)}).`,
      });
    }

    if (isExactIdOrName || bestScore >= 0.45) {
      return Promise.resolve({
        outcome: 'extension',
        matchedEntry: bestMatch,
        similarityScore: bestScore,
        conflicts: [],
        rationale: `Candidate extends existing pattern "${bestMatch.pattern.name}" with additional context or use cases (similarity ${bestScore.toFixed(2)}).`,
      });
    }

    if (bestScore >= 0.25) {
      return Promise.resolve({
        outcome: 'similar',
        matchedEntry: bestMatch,
        similarityScore: bestScore,
        conflicts: [],
        rationale: `Candidate is related to existing pattern "${bestMatch.pattern.name}" (similarity ${bestScore.toFixed(2)}) and can be linked as a related pattern.`,
      });
    }

    return Promise.resolve({
      outcome: 'new',
      similarityScore: bestScore,
      conflicts: [],
      rationale: `Candidate introduces a distinct creative pattern (highest similarity ${bestScore.toFixed(2)} with "${bestMatch.pattern.name}").`,
    });
  }
}
