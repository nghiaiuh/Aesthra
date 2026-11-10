import fs from 'node:fs/promises';
import path from 'node:path';
import {
  type CreativeReference,
  CreativeReferenceSchema,
  NotFoundError,
  type WorkspacePaths,
  readJsonFile,
  writeJsonAtomic,
} from '@aesthra/core';

export class ReferenceCatalogStore {
  constructor(private readonly paths: WorkspacePaths) {}

  getReferencePath(id: string): string {
    return path.join(this.paths.catalogDir, `${id}.json`);
  }

  async list(): Promise<CreativeReference[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.paths.catalogDir);
    } catch {
      return [];
    }

    const refs: CreativeReference[] = [];
    for (const entry of entries.sort()) {
      if (!entry.endsWith('.json')) {
        continue;
      }
      const ref = await readJsonFile(
        path.join(this.paths.catalogDir, entry),
        CreativeReferenceSchema,
      );
      refs.push(ref);
    }
    return refs;
  }

  async findById(id: string): Promise<CreativeReference | undefined> {
    const filePath = this.getReferencePath(id);
    try {
      return await readJsonFile(filePath, CreativeReferenceSchema);
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

  async getById(id: string): Promise<CreativeReference> {
    const found = await this.findById(id);
    if (!found) {
      throw new NotFoundError(`Reference "${id}" was not found in catalog.`, { referenceId: id });
    }
    return found;
  }

  async findByContentHash(contentHash: string): Promise<CreativeReference | undefined> {
    const all = await this.list();
    return all.find((ref) => ref.contentHash === contentHash);
  }

  async findByCanonicalUrl(canonicalUrl: string): Promise<CreativeReference | undefined> {
    const all = await this.list();
    return all.find((ref) => ref.canonicalUrl === canonicalUrl);
  }

  async save(reference: CreativeReference): Promise<void> {
    const validated = CreativeReferenceSchema.parse(reference);
    await writeJsonAtomic(this.getReferencePath(validated.id), validated);
  }
}
