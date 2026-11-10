import {
  type DecisionRecord,
  DecisionRecordSchema,
  type FeedbackEvent,
  FeedbackEventSchema,
  type PersonalPreference,
  PersonalPreferenceSchema,
  type WorkspacePaths,
  appendJsonlRecord,
  createStableId,
  nowIso,
  readJsonlFile,
} from '@aesthra/core';

export class MemoryLogStore {
  constructor(private readonly paths: WorkspacePaths) {}

  async readFeedback(): Promise<FeedbackEvent[]> {
    return readJsonlFile(this.paths.feedbackLogPath, FeedbackEventSchema);
  }

  async appendFeedback(
    input: Omit<FeedbackEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: string },
  ): Promise<FeedbackEvent> {
    const event: FeedbackEvent = FeedbackEventSchema.parse({
      ...input,
      id: input.id ?? createStableId('fb'),
      timestamp: input.timestamp ?? nowIso(),
    });
    await appendJsonlRecord(this.paths.feedbackLogPath, event, FeedbackEventSchema);
    return event;
  }

  async readPreferenceEvents(): Promise<PersonalPreference[]> {
    return readJsonlFile(this.paths.preferencesLogPath, PersonalPreferenceSchema);
  }

  async appendPreferenceEvent(preference: PersonalPreference): Promise<void> {
    await appendJsonlRecord(this.paths.preferencesLogPath, preference, PersonalPreferenceSchema);
  }

  async readDecisions(): Promise<DecisionRecord[]> {
    return readJsonlFile(this.paths.decisionsLogPath, DecisionRecordSchema);
  }

  async appendDecision(
    input: Omit<DecisionRecord, 'id' | 'timestamp'> & { id?: string; timestamp?: string },
  ): Promise<DecisionRecord> {
    const record: DecisionRecord = DecisionRecordSchema.parse({
      ...input,
      id: input.id ?? createStableId('dec'),
      timestamp: input.timestamp ?? nowIso(),
    });
    await appendJsonlRecord(this.paths.decisionsLogPath, record, DecisionRecordSchema);
    return record;
  }
}

