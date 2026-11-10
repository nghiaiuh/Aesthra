import fs from 'node:fs/promises';
import path from 'node:path';
import {
  type CreativeAnalysis,
  CreativeAnalysisSchema,
  NotFoundError,
  type WorkspacePaths,
  readJsonFile,
  writeJsonAtomic,
} from '@aesthra/core';

export class AnalysisStore {
  constructor(private readonly paths: WorkspacePaths) {}

  getAnalysisPath(id: string): string {
    return path.join(this.paths.analysesDir, `${id}.json`);
  }

  async save(analysis: CreativeAnalysis): Promise<void> {
    const validated = CreativeAnalysisSchema.parse(analysis);
    await writeJsonAtomic(this.getAnalysisPath(validated.id), validated);
  }

  async findById(id: string): Promise<CreativeAnalysis | undefined> {
    try {
      return await readJsonFile(this.getAnalysisPath(id), CreativeAnalysisSchema);
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

  async getById(id: string): Promise<CreativeAnalysis> {
    const found = await this.findById(id);
    if (!found) {
      throw new NotFoundError(`Analysis "${id}" was not found.`, { analysisId: id });
    }
    return found;
  }

  async listByReferenceId(referenceId: string): Promise<CreativeAnalysis[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.paths.analysesDir);
    } catch {
      return [];
    }

    const matches: CreativeAnalysis[] = [];
    for (const entry of entries.sort()) {
      if (!entry.endsWith('.json')) {
        continue;
      }
      const analysis = await readJsonFile(
        path.join(this.paths.analysesDir, entry),
        CreativeAnalysisSchema,
      );
      if (analysis.referenceId === referenceId) {
        matches.push(analysis);
      }
    }
    return matches;
  }
}
