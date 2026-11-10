import { z } from 'zod';

export const SourceTypeSchema = z.enum(['image', 'video', 'poster', 'website', 'other']);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const ReferenceStatusSchema = z.enum([
  'registered',
  'pending_analysis',
  'analyzed',
  'analysis_failed',
]);
export type ReferenceStatus = z.infer<typeof ReferenceStatusSchema>;

export const SourceAttributionSchema = z.object({
  creator: z.string().min(1).optional(),
  organization: z.string().min(1).optional(),
  sourceName: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
});
export type SourceAttribution = z.infer<typeof SourceAttributionSchema>;

export const LicenseInformationSchema = z.object({
  license: z.string().min(1).optional(),
  permissionStatus: z
    .enum(['unknown', 'own_work', 'licensed', 'public_domain', 'reference_only'])
    .default('unknown'),
  usageNotes: z.string().min(1).optional(),
});
export type LicenseInformation = z.infer<typeof LicenseInformationSchema>;

export const TechnicalMetadataSchema = z.object({
  fileSizeBytes: z.number().int().nonnegative().optional(),
  mimeType: z.string().min(1).optional(),
  extension: z.string().min(1).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationSeconds: z.number().nonnegative().optional(),
  codec: z.string().min(1).optional(),
});
export type TechnicalMetadata = z.infer<typeof TechnicalMetadataSchema>;

export const UserNoteSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  addedAt: z.iso.datetime(),
});
export type UserNote = z.infer<typeof UserNoteSchema>;

export const CreativeReferenceSchema = z
  .object({
    id: z.string().regex(/^ref_[a-zA-Z0-9_-]+$/),
    sourceType: SourceTypeSchema,
    sourceUrl: z.url().optional(),
    canonicalUrl: z.url().optional(),
    localPath: z.string().min(1).optional(),
    title: z.string().min(1),
    description: z.string().default(''),
    tags: z.array(z.string().min(1)).default([]),
    sourceAttribution: SourceAttributionSchema.default({}),
    licenseInformation: LicenseInformationSchema.optional(),
    contentHash: z
      .string()
      .regex(/^sha256:[a-f0-9]{64}$/)
      .optional(),
    technicalMetadata: TechnicalMetadataSchema.optional(),
    importedAt: z.iso.datetime(),
    status: ReferenceStatusSchema,
    userNotes: z.array(UserNoteSchema).default([]),
    analysisIds: z.array(z.string().min(1)).default([]),
  })
  .refine((value) => Boolean(value.sourceUrl || value.localPath), {
    message: 'CreativeReference must specify at least sourceUrl or localPath.',
  });
export type CreativeReference = z.infer<typeof CreativeReferenceSchema>;

export const AnalysisDimensionSchema = z.enum([
  'composition',
  'color',
  'lighting',
  'typography',
  'camera',
  'pacing',
  'motion',
  'transitions',
  'storytelling',
  'emotionalTone',
  'technical',
]);
export type AnalysisDimension = z.infer<typeof AnalysisDimensionSchema>;

export const ObservationEvidenceTypeSchema = z.enum([
  'technical_metadata',
  'user_observation',
  'model_observation',
  'verified_observation',
]);
export type ObservationEvidenceType = z.infer<typeof ObservationEvidenceTypeSchema>;

export const InterpretationEvidenceTypeSchema = z.enum([
  'user_interpretation',
  'model_interpretation',
  'uncertain_interpretation',
]);
export type InterpretationEvidenceType = z.infer<typeof InterpretationEvidenceTypeSchema>;

export const CreativeDomainSchema = z.enum([
  'foundations',
  'cinematic',
  'editorial-design',
  'graphic-design',
  'branding',
  'typography',
  'motion-design',
  'web-experience',
  'product-advertising',
]);
export type CreativeDomain = z.infer<typeof CreativeDomainSchema>;

export const KnowledgeCategorySchema = z.enum([
  'foundations',
  'cinematic',
  'graphic-design',
  'motion-design',
  'patterns',
  'styles',
  'recipes',
]);
export type KnowledgeCategory = z.infer<typeof KnowledgeCategorySchema>;

export const ObservationItemSchema = z.object({
  id: z.string().min(1),
  dimension: AnalysisDimensionSchema,
  statement: z.string().min(1),
  evidenceType: ObservationEvidenceTypeSchema,
  evidenceRef: z.string().min(1).optional(),
});
export type ObservationItem = z.infer<typeof ObservationItemSchema>;

export const InterpretationItemSchema = z.object({
  id: z.string().min(1),
  dimension: AnalysisDimensionSchema,
  statement: z.string().min(1),
  rationale: z.string().min(1),
  evidenceType: InterpretationEvidenceTypeSchema,
});
export type InterpretationItem = z.infer<typeof InterpretationItemSchema>;

export const CandidatePatternDraftSchema = z.object({
  name: z.string().min(1),
  category: KnowledgeCategorySchema.default('patterns'),
  domain: CreativeDomainSchema,
  summary: z.string().min(1),
  principle: z.string().min(1),
  whyItWorks: z.string().min(1),
  useCases: z.array(z.string().min(1)).min(1),
  constraints: z.array(z.string().min(1)).default([]),
  commonMistakes: z.array(z.string().min(1)).default([]),
  tags: z.array(z.string().min(1)).default([]),
  confidence: z.number().min(0).max(1),
});
export type CandidatePatternDraft = z.infer<typeof CandidatePatternDraftSchema>;

export const SourceEvidenceSchema = z.object({
  mediaAccessible: z.boolean(),
  inspectedSourceType: z.enum([
    'local_file',
    'structured_json_import',
    'metadata_only',
    'remote_media',
  ]),
  sourcePathOrUrl: z.string().min(1).optional(),
  contentHash: z.string().min(1).optional(),
  limitations: z.array(z.string().min(1)).default([]),
});
export type SourceEvidence = z.infer<typeof SourceEvidenceSchema>;

export const CreativeAnalysisSchema = z.object({
  id: z.string().regex(/^ana_[a-zA-Z0-9_-]+$/),
  referenceId: z.string().regex(/^ref_[a-zA-Z0-9_-]+$/),
  analyzer: z.string().min(1),
  analyzerVersion: z.string().min(1),
  analysisKind: z.enum(['technical_metadata', 'manual_structured', 'hybrid', 'vision_model']),
  analyzedAt: z.iso.datetime(),
  observations: z.array(ObservationItemSchema).default([]),
  interpretations: z.array(InterpretationItemSchema).default([]),
  confidence: z.number().min(0).max(1),
  uncertainty: z.array(z.string().min(1)).default([]),
  extractedPatterns: z.array(CandidatePatternDraftSchema).default([]),
  sourceEvidence: SourceEvidenceSchema,
});
export type CreativeAnalysis = z.infer<typeof CreativeAnalysisSchema>;

export const AnalysisImportInputSchema = z.object({
  referenceId: z
    .string()
    .regex(/^ref_[a-zA-Z0-9_-]+$/)
    .optional(),
  analyzer: z.string().min(1).default('user-structured-import'),
  analyzerVersion: z.string().min(1).default('1.0.0'),
  observations: z
    .array(
      z.object({
        id: z.string().min(1).optional(),
        dimension: AnalysisDimensionSchema,
        statement: z.string().min(1),
        evidenceType: ObservationEvidenceTypeSchema.default('user_observation'),
        evidenceRef: z.string().min(1).optional(),
      }),
    )
    .default([]),
  interpretations: z
    .array(
      z.object({
        id: z.string().min(1).optional(),
        dimension: AnalysisDimensionSchema,
        statement: z.string().min(1),
        rationale: z.string().min(1),
        evidenceType: InterpretationEvidenceTypeSchema.default('user_interpretation'),
      }),
    )
    .default([]),
  confidence: z.number().min(0).max(1).default(0.75),
  uncertainty: z.array(z.string().min(1)).default([]),
  extractedPatterns: z.array(CandidatePatternDraftSchema).default([]),
  sourceEvidence: SourceEvidenceSchema.optional(),
});
export type AnalysisImportInput = z.infer<typeof AnalysisImportInputSchema>;

export const KnowledgeOriginSchema = z.enum([
  'illustrative_seed',
  'learned_reference',
  'manual_authoring',
]);
export type KnowledgeOrigin = z.infer<typeof KnowledgeOriginSchema>;

export const KnowledgePatternStatusSchema = z.enum(['draft', 'approved', 'deprecated']);
export type KnowledgePatternStatus = z.infer<typeof KnowledgePatternStatusSchema>;

export const KnowledgePatternSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1),
  category: KnowledgeCategorySchema,
  domain: CreativeDomainSchema,
  summary: z.string().min(1),
  description: z.string().min(1),
  principles: z.array(z.string().min(1)).min(1),
  whyItWorks: z.string().min(1),
  useCases: z.array(z.string().min(1)).min(1),
  constraints: z.array(z.string().min(1)).default([]),
  commonMistakes: z.array(z.string().min(1)).default([]),
  sourceReferenceIds: z.array(z.string().min(1)).default([]),
  relatedPatternIds: z.array(z.string().min(1)).default([]),
  tags: z.array(z.string().min(1)).default([]),
  origin: KnowledgeOriginSchema.default('learned_reference'),
  confidence: z.number().min(0).max(1),
  status: KnowledgePatternStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type KnowledgePattern = z.infer<typeof KnowledgePatternSchema>;

export const PreferenceCategorySchema = z.enum([
  'visual_identity',
  'composition',
  'typography',
  'color',
  'lighting',
  'motion',
  'cinematic_language',
  'creative_influences',
  'negative_preferences',
]);
export type PreferenceCategory = z.infer<typeof PreferenceCategorySchema>;

export const PreferencePolaritySchema = z.enum(['prefer', 'avoid', 'neutral']);
export type PreferencePolarity = z.infer<typeof PreferencePolaritySchema>;

export const PreferenceStatusSchema = z.enum(['tentative', 'explicit', 'rejected']);
export type PreferenceStatus = z.infer<typeof PreferenceStatusSchema>;

export const PersonalPreferenceSchema = z.object({
  id: z.string().regex(/^pref_[a-zA-Z0-9_-]+$/),
  category: PreferenceCategorySchema,
  preference: z.string().min(1),
  polarity: PreferencePolaritySchema,
  strength: z.number().min(0).max(1),
  sourceFeedbackIds: z.array(z.string().min(1)).default([]),
  evidence: z.array(z.string().min(1)).default([]),
  status: PreferenceStatusSchema,
  updatedAt: z.iso.datetime(),
});
export type PersonalPreference = z.infer<typeof PersonalPreferenceSchema>;

export const DesignDnaCategoryBucketSchema = z.object({
  explicit: z.array(PersonalPreferenceSchema).default([]),
  tentative: z.array(PersonalPreferenceSchema).default([]),
});
export type DesignDnaCategoryBucket = z.infer<typeof DesignDnaCategoryBucketSchema>;

export const DesignDnaSchema = z.object({
  schemaVersion: z.literal(1),
  owner: z.string().min(1),
  note: z.string().min(1).optional(),
  updatedAt: z.iso.datetime(),
  categories: z.object({
    visual_identity: DesignDnaCategoryBucketSchema,
    composition: DesignDnaCategoryBucketSchema,
    typography: DesignDnaCategoryBucketSchema,
    color: DesignDnaCategoryBucketSchema,
    lighting: DesignDnaCategoryBucketSchema,
    motion: DesignDnaCategoryBucketSchema,
    cinematic_language: DesignDnaCategoryBucketSchema,
    creative_influences: DesignDnaCategoryBucketSchema,
    negative_preferences: DesignDnaCategoryBucketSchema,
  }),
});
export type DesignDna = z.infer<typeof DesignDnaSchema>;

export const FeedbackEventSchema = z.object({
  id: z.string().regex(/^fb_[a-zA-Z0-9_-]+$/),
  timestamp: z.iso.datetime(),
  source: z.enum(['explicit_user', 'agent_inferred']),
  referenceId: z.string().min(1).optional(),
  proposalId: z.string().min(1).optional(),
  category: PreferenceCategorySchema,
  statement: z.string().min(1),
  polarity: PreferencePolaritySchema,
  notes: z.string().min(1).optional(),
});
export type FeedbackEvent = z.infer<typeof FeedbackEventSchema>;

export const DecisionRecordSchema = z.object({
  id: z.string().regex(/^dec_[a-zA-Z0-9_-]+$/),
  timestamp: z.iso.datetime(),
  proposalId: z.string().min(1),
  referenceId: z.string().min(1),
  decision: z.enum(['approved', 'rejected']),
  actor: z.literal('human'),
  rationale: z.string().min(1).optional(),
  targetPath: z.string().min(1),
  appliedAt: z.iso.datetime().optional(),
});
export type DecisionRecord = z.infer<typeof DecisionRecordSchema>;

export const ProposalTypeSchema = z.enum([
  'knowledge_pattern',
  'style',
  'recipe',
  'preference',
  'skill_update',
  'new_skill',
]);
export type ProposalType = z.infer<typeof ProposalTypeSchema>;

export const ProposalStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'applied',
  'failed',
]);
export type ProposalStatus = z.infer<typeof ProposalStatusSchema>;

export const ComparisonOutcomeSchema = z.enum([
  'new',
  'similar',
  'duplicate',
  'extension',
  'conflict',
  'insufficient_evidence',
]);
export type ComparisonOutcome = z.infer<typeof ComparisonOutcomeSchema>;

export const ProposalConflictSchema = z.object({
  targetId: z.string().min(1),
  targetPath: z.string().min(1),
  reason: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high']),
});
export type ProposalConflict = z.infer<typeof ProposalConflictSchema>;

export const ProposalEvidenceSchema = z.object({
  type: z.enum(['analysis_observation', 'user_note', 'technical_metadata', 'feedback']),
  id: z.string().min(1).optional(),
  summary: z.string().min(1),
});
export type ProposalEvidence = z.infer<typeof ProposalEvidenceSchema>;

export const ProposedChangeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('knowledge_pattern'),
    pattern: KnowledgePatternSchema,
    markdownPreview: z.string().min(1),
  }),
  z.object({
    kind: z.literal('preference'),
    preference: PersonalPreferenceSchema,
    feedbackId: z.string().min(1).optional(),
  }),
  z.object({
    kind: z.literal('skill_update'),
    skillName: z.string().min(1),
    summary: z.string().min(1),
    content: z.string().min(1),
  }),
  z.object({
    kind: z.literal('new_skill'),
    skillName: z.string().min(1),
    summary: z.string().min(1),
    content: z.string().min(1),
  }),
]);
export type ProposedChange = z.infer<typeof ProposedChangeSchema>;

export const LearningProposalSchema = z.object({
  id: z.string().regex(/^prop_[a-zA-Z0-9_-]+$/),
  referenceId: z.string().regex(/^ref_[a-zA-Z0-9_-]+$/),
  analysisId: z.string().min(1).optional(),
  proposalType: ProposalTypeSchema,
  action: z.enum(['create', 'update']),
  targetPath: z.string().min(1),
  baseFileHash: z.string().min(1).optional(),
  proposedChange: ProposedChangeSchema,
  rationale: z.string().min(1),
  evidence: z.array(ProposalEvidenceSchema).min(1),
  confidence: z.number().min(0).max(1),
  comparisonOutcome: ComparisonOutcomeSchema,
  conflicts: z.array(ProposalConflictSchema).default([]),
  status: ProposalStatusSchema,
  createdAt: z.iso.datetime(),
  reviewedAt: z.iso.datetime().optional(),
  reviewNote: z.string().min(1).optional(),
  appliedAt: z.iso.datetime().optional(),
  errorMessage: z.string().min(1).optional(),
});
export type LearningProposal = z.infer<typeof LearningProposalSchema>;
