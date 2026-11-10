import {
  type DecisionRecord,
  type DesignDna,
  type FeedbackEvent,
  type PersonalPreference,
  type PreferenceCategory,
  type PreferencePolarity,
  type WorkspacePaths,
  createStableId,
  nowIso,
} from '@aesthra/core';
import { DesignDnaStore } from './design-dna.js';
import { MemoryLogStore } from './logs.js';

export interface ProfileSnapshot {
  designDna: DesignDna;
  preferences: Array<PersonalPreference & { bucket: 'explicit' | 'tentative' }>;
  recentFeedback: FeedbackEvent[];
  recentDecisions: DecisionRecord[];
}

export class MemoryService {
  public readonly dnaStore: DesignDnaStore;
  public readonly logs: MemoryLogStore;

  constructor(paths: WorkspacePaths) {
    this.dnaStore = new DesignDnaStore(paths);
    this.logs = new MemoryLogStore(paths);
  }

  async getProfile(): Promise<ProfileSnapshot> {
    const [designDna, recentFeedback, recentDecisions] = await Promise.all([
      this.dnaStore.load(),
      this.logs.readFeedback(),
      this.logs.readDecisions(),
    ]);

    return {
      designDna,
      preferences: this.dnaStore.listPreferences(designDna),
      recentFeedback: recentFeedback.slice(-10),
      recentDecisions: recentDecisions.slice(-10),
    };
  }

  async recordFeedback(input: {
    source: 'explicit_user' | 'agent_inferred';
    category: PreferenceCategory;
    statement: string;
    polarity: PreferencePolarity;
    referenceId?: string;
    proposalId?: string;
    notes?: string;
  }): Promise<FeedbackEvent> {
    return this.logs.appendFeedback(input);
  }

  createCandidatePreference(input: {
    category: PreferenceCategory;
    preference: string;
    polarity: PreferencePolarity;
    source: 'explicit_user' | 'agent_inferred';
    sourceFeedbackIds: string[];
    evidence: string[];
    strength?: number;
  }): PersonalPreference {
    // Only explicit user feedback can be created as an explicit preference;
    // agent-inferred preferences remain tentative until reviewed and explicitly approved.
    const status = input.source === 'explicit_user' ? 'explicit' : 'tentative';
    const defaultStrength = input.source === 'explicit_user' ? 0.85 : 0.45;
    return {
      id: createStableId('pref', `${input.category}:${input.preference.toLowerCase()}`),
      category: input.category,
      preference: input.preference,
      polarity: input.polarity,
      strength: input.strength ?? defaultStrength,
      sourceFeedbackIds: input.sourceFeedbackIds,
      evidence: input.evidence,
      status,
      updatedAt: nowIso(),
    };
  }

  async applyApprovedPreference(
    preference: PersonalPreference,
    expectedBaseHash?: string,
  ): Promise<DesignDna> {
    const approvedPref: PersonalPreference = {
      ...preference,
      status: preference.status === 'rejected' ? 'rejected' : preference.status,
      updatedAt: nowIso(),
    };
    const updatedDna = await this.dnaStore.upsertPreference(approvedPref, expectedBaseHash);
    await this.logs.appendPreferenceEvent(approvedPref);
    return updatedDna;
  }

  async recordDecision(input: {
    proposalId: string;
    referenceId: string;
    decision: 'approved' | 'rejected';
    rationale?: string;
    targetPath: string;
    appliedAt?: string;
  }): Promise<DecisionRecord> {
    return this.logs.appendDecision({
      ...input,
      actor: 'human',
    });
  }
}

