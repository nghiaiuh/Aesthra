import fs from 'node:fs/promises';
import path from 'node:path';
import {
  type LearningProposal,
  LearningProposalSchema,
  NotFoundError,
  type ProposalStatus,
  type WorkspacePaths,
  readJsonFile,
  writeJsonAtomic,
} from '@aesthra/core';

export class ProposalInboxStore {
  constructor(private readonly paths: WorkspacePaths) {}

  getProposalPath(id: string): string {
    return path.join(this.paths.inboxDir, `${id}.json`);
  }

  async list(filter?: { status?: ProposalStatus }): Promise<LearningProposal[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.paths.inboxDir);
    } catch {
      return [];
    }

    const proposals: LearningProposal[] = [];
    for (const entry of entries.sort()) {
      if (!entry.endsWith('.json')) {
        continue;
      }
      const proposal = await readJsonFile(
        path.join(this.paths.inboxDir, entry),
        LearningProposalSchema,
      );
      if (!filter?.status || proposal.status === filter.status) {
        proposals.push(proposal);
      }
    }
    return proposals;
  }

  async findById(id: string): Promise<LearningProposal | undefined> {
    try {
      return await readJsonFile(this.getProposalPath(id), LearningProposalSchema);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: unknown }).code === 'ENOENT'
      ) {
        return undefined;
      }
      throw error;
    }
  }

  async getById(id: string): Promise<LearningProposal> {
    const found = await this.findById(id);
    if (!found) {
      throw new NotFoundError(`Proposal "${id}" was not found in learning inbox.`, {
        proposalId: id,
      });
    }
    return found;
  }

  async save(proposal: LearningProposal): Promise<void> {
    const validated = LearningProposalSchema.parse(proposal);
    await writeJsonAtomic(this.getProposalPath(validated.id), validated);
  }
}
