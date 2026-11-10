import fs from 'node:fs/promises';
import { AnalysisStore } from '@aesthra/analysis';
import {
  type CandidatePatternDraft,
  ConflictError,
  type KnowledgePattern,
  KnowledgePatternSchema,
  type LearningProposal,
  LearningProposalSchema,
  type PreferenceCategory,
  type PreferencePolarity,
  type ProposalType,
  ValidationError,
  type WorkspacePaths,
  createStableId,
  fileExists,
  nowIso,
  resolveSafeTargetPath,
  sha256File,
  slugify,
  writeTextAtomic,
} from '@aesthra/core';
import { ReferenceCatalogStore } from '@aesthra/ingestion';
import { MemoryService } from '@aesthra/memory';
import { DeterministicKnowledgeComparator, type KnowledgeComparator } from './comparator.js';
import { extractCandidatePatterns } from './extractor.js';
import {
  type StoredKnowledgeEntry,
  loadKnowledgePatterns,
  parseKnowledgePatternMarkdown,
  serializeKnowledgePatternMarkdown,
} from './markdown.js';
import { ProposalInboxStore } from './proposals.js';

export interface ProposalGenerationReport {
  referenceId: string;
  proposals: LearningProposal[];
  skippedDuplicates: Array<{ candidateName: string; matchedId: string; targetPath: string }>;
  insufficientEvidence: boolean;
  reason?: string;
}

export interface ExplicitPreferenceInput {
  category: PreferenceCategory;
  preference: string;
  polarity: PreferencePolarity;
  rationale?: string;
}

function getAllowedPrefixesForProposalType(proposalType: ProposalType): readonly string[] {
  switch (proposalType) {
    case 'knowledge_pattern':
    case 'style':
    case 'recipe':
      return ['knowledge'];
    case 'preference':
      return ['memory'];
    case 'skill_update':
    case 'new_skill':
      return ['skills'];
  }
}

function mergeExtendedPattern(
  existing: KnowledgePattern,
  draft: CandidatePatternDraft,
  referenceId: string,
  timestamp: string,
): KnowledgePattern {
  const uniqueStrings = (arr: string[]): string[] => [...new Set(arr)];
  return KnowledgePatternSchema.parse({
    ...existing,
    principles: uniqueStrings([...existing.principles, draft.principle]),
    useCases: uniqueStrings([...existing.useCases, ...draft.useCases]),
    constraints: uniqueStrings([...existing.constraints, ...draft.constraints]),
    commonMistakes: uniqueStrings([...existing.commonMistakes, ...draft.commonMistakes]),
    tags: uniqueStrings([...existing.tags, ...draft.tags]),
    sourceReferenceIds: uniqueStrings([...existing.sourceReferenceIds, referenceId]),
    confidence: Math.max(existing.confidence, draft.confidence),
    updatedAt: timestamp,
  });
}

function buildNewPattern(
  draft: CandidatePatternDraft,
  referenceId: string,
  relatedPatternIds: string[],
  timestamp: string,
): KnowledgePattern {
  const id = slugify(draft.name);
  return KnowledgePatternSchema.parse({
    id,
    name: draft.name,
    category: draft.category,
    domain: draft.domain,
    summary: draft.summary,
    description: draft.principle,
    principles: [draft.principle],
    whyItWorks: draft.whyItWorks,
    useCases: draft.useCases,
    constraints: draft.constraints,
    commonMistakes: draft.commonMistakes,
    sourceReferenceIds: [referenceId],
    relatedPatternIds,
    tags: [...new Set(draft.tags.map((t) => t.toLowerCase()))],
    origin: 'learned_reference',
    confidence: draft.confidence,
    status: 'approved',
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

function resolveNewTargetPath(
  patternId: string,
  category: CandidatePatternDraft['category'],
  outcome: 'new' | 'similar' | 'conflict',
): string {
  const suffix = outcome === 'conflict' ? '-alternative' : '';
  return `knowledge/${category}/${patternId}${suffix}.md`;
}

export class KnowledgeCurator {
  public readonly catalog: ReferenceCatalogStore;
  public readonly analysisStore: AnalysisStore;
  public readonly inbox: ProposalInboxStore;
  public readonly memory: MemoryService;
  private readonly comparator: KnowledgeComparator;

  constructor(
    private readonly paths: WorkspacePaths,
    comparator: KnowledgeComparator = new DeterministicKnowledgeComparator(),
  ) {
    this.catalog = new ReferenceCatalogStore(paths);
    this.analysisStore = new AnalysisStore(paths);
    this.inbox = new ProposalInboxStore(paths);
    this.memory = new MemoryService(paths);
    this.comparator = comparator;
  }

  async listKnowledge(): Promise<StoredKnowledgeEntry[]> {
    return loadKnowledgePatterns(this.paths.root, this.paths.knowledgeDir);
  }

  async generateProposalsForReference(
    referenceId: string,
    options?: {
      includeDuplicates?: boolean;
      explicitPreference?: ExplicitPreferenceInput;
    },
  ): Promise<ProposalGenerationReport> {
    const reference = await this.catalog.getById(referenceId);
    const analyses = await this.analysisStore.listByReferenceId(referenceId);
    const existingKnowledge = await this.listKnowledge();

    const proposals: LearningProposal[] = [];
    const skippedDuplicates: Array<{
      candidateName: string;
      matchedId: string;
      targetPath: string;
    }> = [];

    const extraction = extractCandidatePatterns(reference, analyses);
    const timestamp = nowIso();

    for (const candidate of extraction.candidates) {
      const comparison = await this.comparator.compare(candidate.draft, existingKnowledge);

      if (comparison.outcome === 'duplicate' && !options?.includeDuplicates) {
        if (comparison.matchedEntry) {
          skippedDuplicates.push({
            candidateName: candidate.draft.name,
            matchedId: comparison.matchedEntry.pattern.id,
            targetPath: comparison.matchedEntry.relativePath,
          });
        }
        continue;
      }

      const proposalType: ProposalType =
        candidate.draft.category === 'styles'
          ? 'style'
          : candidate.draft.category === 'recipes'
            ? 'recipe'
            : 'knowledge_pattern';

      let action: 'create' | 'update' = 'create';
      let targetPath: string;
      let baseFileHash: string | undefined;
      let targetPattern: KnowledgePattern;

      if (comparison.outcome === 'extension' && comparison.matchedEntry) {
        action = 'update';
        targetPath = comparison.matchedEntry.relativePath;
        baseFileHash = comparison.matchedEntry.fileHash;
        targetPattern = mergeExtendedPattern(
          comparison.matchedEntry.pattern,
          candidate.draft,
          reference.id,
          timestamp,
        );
      } else {
        const baseId = slugify(candidate.draft.name);
        const related =
          comparison.outcome === 'similar' && comparison.matchedEntry
            ? [comparison.matchedEntry.pattern.id]
            : [];
        const uniqueId = comparison.outcome === 'conflict' ? `${baseId}-alternative` : baseId;
        targetPattern = buildNewPattern(
          { ...candidate.draft, name: candidate.draft.name },
          reference.id,
          related,
          timestamp,
        );
        targetPattern = {
          ...targetPattern,
          id: uniqueId,
        };
        targetPath = resolveNewTargetPath(
          baseId,
          candidate.draft.category,
          comparison.outcome === 'conflict'
            ? 'conflict'
            : comparison.outcome === 'similar'
              ? 'similar'
              : 'new',
        );
      }

      const markdownPreview = serializeKnowledgePatternMarkdown(targetPattern);
      const proposal: LearningProposal = LearningProposalSchema.parse({
        id: createStableId('prop'),
        referenceId: reference.id,
        analysisId: candidate.analysisId,
        proposalType,
        action,
        targetPath,
        ...(baseFileHash ? { baseFileHash } : {}),
        proposedChange: {
          kind: 'knowledge_pattern',
          pattern: targetPattern,
          markdownPreview,
        },
        rationale: comparison.rationale,
        evidence: candidate.evidence,
        confidence: candidate.draft.confidence,
        comparisonOutcome: comparison.outcome,
        conflicts: comparison.conflicts,
        status: 'pending',
        createdAt: timestamp,
      });

      await this.inbox.save(proposal);
      proposals.push(proposal);
    }

    if (options?.explicitPreference) {
      const fb = await this.memory.recordFeedback({
        source: 'explicit_user',
        referenceId: reference.id,
        category: options.explicitPreference.category,
        statement: options.explicitPreference.preference,
        polarity: options.explicitPreference.polarity,
        ...(options.explicitPreference.rationale
          ? { notes: options.explicitPreference.rationale }
          : {}),
      });

      const candidatePref = this.memory.createCandidatePreference({
        category: options.explicitPreference.category,
        preference: options.explicitPreference.preference,
        polarity: options.explicitPreference.polarity,
        source: 'explicit_user',
        sourceFeedbackIds: [fb.id],
        evidence: [
          options.explicitPreference.rationale ??
            `Explicit user feedback while reviewing reference ${reference.id}.`,
        ],
      });

      const baseDnaHash = await this.memory.dnaStore.getFileHash();
      const prefProposal: LearningProposal = LearningProposalSchema.parse({
        id: createStableId('prop'),
        referenceId: reference.id,
        proposalType: 'preference',
        action: 'update',
        targetPath: 'memory/design-dna.yaml',
        ...(baseDnaHash ? { baseFileHash: baseDnaHash } : {}),
        proposedChange: {
          kind: 'preference',
          preference: candidatePref,
          feedbackId: fb.id,
        },
        rationale: `Explicit user preference recorded in feedback ${fb.id}; awaiting approval to update Personal Design DNA.`,
        evidence: [
          {
            type: 'feedback',
            id: fb.id,
            summary: `[${fb.category} / ${fb.polarity}] ${fb.statement}`,
          },
        ],
        confidence: 0.9,
        comparisonOutcome: 'new',
        conflicts: [],
        status: 'pending',
        createdAt: timestamp,
      });

      await this.inbox.save(prefProposal);
      proposals.push(prefProposal);
    }

    const reportReason =
      extraction.insufficientEvidence && !options?.explicitPreference
        ? extraction.reason
        : skippedDuplicates.length > 0 && proposals.length === 0
          ? `All ${skippedDuplicates.length} candidate pattern(s) closely duplicate existing approved knowledge.`
          : undefined;

    return {
      referenceId: reference.id,
      proposals,
      skippedDuplicates,
      insufficientEvidence: extraction.insufficientEvidence && proposals.length === 0,
      ...(reportReason ? { reason: reportReason } : {}),
    };
  }

  async createProposal(proposal: LearningProposal): Promise<LearningProposal> {
    const validated = LearningProposalSchema.parse(proposal);
    const allowedPrefixes = getAllowedPrefixesForProposalType(validated.proposalType);
    await resolveSafeTargetPath(this.paths.root, validated.targetPath, allowedPrefixes);
    await this.inbox.save(validated);
    return validated;
  }

  async approveProposal(
    proposalId: string,
    options?: { reviewNote?: string },
  ): Promise<LearningProposal> {
    const proposal = await this.inbox.getById(proposalId);
    if (proposal.status !== 'pending') {
      throw new ConflictError(
        `Proposal "${proposal.id}" cannot be approved because its status is "${proposal.status}".`,
        { proposalId: proposal.id, status: proposal.status },
      );
    }

    const allowedPrefixes = getAllowedPrefixesForProposalType(proposal.proposalType);
    let resolvedTargetPath: string;
    try {
      resolvedTargetPath = await resolveSafeTargetPath(
        this.paths.root,
        proposal.targetPath,
        allowedPrefixes,
      );
    } catch (error) {
      const failed: LearningProposal = {
        ...proposal,
        status: 'failed',
        reviewedAt: nowIso(),
        errorMessage: error instanceof Error ? error.message : String(error),
      };
      await this.inbox.save(failed);
      throw error;
    }

    const exists = await fileExists(resolvedTargetPath);
    if (proposal.action === 'create' && exists) {
      const msg = `Target file "${proposal.targetPath}" already exists; refusing to overwrite on create.`;
      await this.inbox.save({
        ...proposal,
        status: 'failed',
        reviewedAt: nowIso(),
        errorMessage: msg,
      });
      throw new ConflictError(msg, { proposalId: proposal.id, targetPath: proposal.targetPath });
    }

    if (proposal.action === 'update') {
      if (!exists) {
        const msg = `Target file "${proposal.targetPath}" no longer exists for update.`;
        await this.inbox.save({
          ...proposal,
          status: 'failed',
          reviewedAt: nowIso(),
          errorMessage: msg,
        });
        throw new ConflictError(msg, { proposalId: proposal.id, targetPath: proposal.targetPath });
      }
      if (proposal.baseFileHash) {
        const currentHash = await sha256File(resolvedTargetPath);
        if (currentHash !== proposal.baseFileHash) {
          const msg = `Target file "${proposal.targetPath}" was modified externally since proposal creation.`;
          await this.inbox.save({
            ...proposal,
            status: 'failed',
            reviewedAt: nowIso(),
            errorMessage: msg,
          });
          throw new ConflictError(msg, {
            proposalId: proposal.id,
            targetPath: proposal.targetPath,
            expectedHash: proposal.baseFileHash,
            currentHash,
          });
        }
      }
    }

    const reviewedAt = nowIso();

    try {
      if (proposal.proposedChange.kind === 'knowledge_pattern') {
        const validatedPattern = KnowledgePatternSchema.parse({
          ...proposal.proposedChange.pattern,
          status: 'approved',
          updatedAt: reviewedAt,
        });
        const markdown = serializeKnowledgePatternMarkdown(validatedPattern);
        await writeTextAtomic(resolvedTargetPath, markdown);
      } else if (proposal.proposedChange.kind === 'preference') {
        await this.memory.applyApprovedPreference(
          proposal.proposedChange.preference,
          proposal.baseFileHash,
        );
      } else {
        const content = proposal.proposedChange.content;
        if (!content.trim().startsWith('---')) {
          throw new ValidationError('Skill content must begin with valid YAML frontmatter.');
        }
        await writeTextAtomic(resolvedTargetPath, content);
      }
    } catch (error) {
      await this.inbox.save({
        ...proposal,
        status: 'failed',
        reviewedAt,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    const appliedAt = nowIso();
    const applied: LearningProposal = {
      ...proposal,
      status: 'applied',
      reviewedAt,
      appliedAt,
      ...(options?.reviewNote ? { reviewNote: options.reviewNote } : {}),
    };
    await this.inbox.save(applied);

    await this.memory.recordDecision({
      proposalId: applied.id,
      referenceId: applied.referenceId,
      decision: 'approved',
      targetPath: applied.targetPath,
      appliedAt,
      ...(options?.reviewNote ? { rationale: options.reviewNote } : {}),
    });

    return applied;
  }

  async rejectProposal(
    proposalId: string,
    options?: { reviewNote?: string },
  ): Promise<LearningProposal> {
    const proposal = await this.inbox.getById(proposalId);
    if (proposal.status !== 'pending') {
      throw new ConflictError(
        `Proposal "${proposal.id}" cannot be rejected because its status is "${proposal.status}".`,
        { proposalId: proposal.id, status: proposal.status },
      );
    }

    const reviewedAt = nowIso();
    const rejected: LearningProposal = {
      ...proposal,
      status: 'rejected',
      reviewedAt,
      ...(options?.reviewNote ? { reviewNote: options.reviewNote } : {}),
    };
    await this.inbox.save(rejected);

    await this.memory.recordDecision({
      proposalId: rejected.id,
      referenceId: rejected.referenceId,
      decision: 'rejected',
      targetPath: rejected.targetPath,
      ...(options?.reviewNote ? { rationale: options.reviewNote } : {}),
    });

    return rejected;
  }

  async verifyKnowledgeHealth(): Promise<{ validCount: number; errors: string[] }> {
    const errors: string[] = [];
    let validCount = 0;

    const walk = async (dir: string): Promise<void> => {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          await walk(full);
        } else if (
          entry.isFile() &&
          entry.name.endsWith('.md') &&
          entry.name.toLowerCase() !== 'readme.md'
        ) {
          try {
            const content = await fs.readFile(full, 'utf8');
            parseKnowledgePatternMarkdown(content, full);
            validCount++;
          } catch (error) {
            errors.push(error instanceof Error ? error.message : String(error));
          }
        }
      }
    };

    await walk(this.paths.knowledgeDir);
    return { validCount, errors };
  }
}
