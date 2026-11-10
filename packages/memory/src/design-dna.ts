import {
  ConflictError,
  type DesignDna,
  DesignDnaSchema,
  type PersonalPreference,
  PersonalPreferenceSchema,
  type PreferenceCategory,
  type WorkspacePaths,
  createInitialDesignDna,
  fileExists,
  nowIso,
  readYamlFile,
  sha256File,
  writeYamlAtomic,
} from '@aesthra/core';

const DESIGN_DNA_HEADER = `# Aesthra Personal Design DNA
#
# Personal taste is kept distinct from general creative knowledge (knowledge/).
# Only explicitly stated or human-approved preferences belong in "explicit".
# Agent-suggested patterns not yet confirmed by the user stay "tentative" until reviewed.`;

export class DesignDnaStore {
  constructor(private readonly paths: WorkspacePaths) {}

  async load(): Promise<DesignDna> {
    if (!(await fileExists(this.paths.designDnaPath))) {
      return DesignDnaSchema.parse(createInitialDesignDna());
    }
    return readYamlFile(this.paths.designDnaPath, DesignDnaSchema);
  }

  async getFileHash(): Promise<string | undefined> {
    if (!(await fileExists(this.paths.designDnaPath))) {
      return undefined;
    }
    return sha256File(this.paths.designDnaPath);
  }

  async save(dna: DesignDna, expectedBaseHash?: string): Promise<void> {
    const validated = DesignDnaSchema.parse(dna);
    if (expectedBaseHash !== undefined) {
      const currentHash = await this.getFileHash();
      if (currentHash !== expectedBaseHash) {
        throw new ConflictError(
          'Design DNA file changed on disk since proposal was created; aborting overwrite.',
          {
            targetPath: 'memory/design-dna.yaml',
            expectedBaseHash,
            currentHash,
          },
        );
      }
    }
    await writeYamlAtomic(this.paths.designDnaPath, validated, DESIGN_DNA_HEADER);
  }

  async upsertPreference(
    preferenceInput: PersonalPreference,
    expectedBaseHash?: string,
  ): Promise<DesignDna> {
    const preference = PersonalPreferenceSchema.parse(preferenceInput);
    const dna = await this.load();
    const bucket = dna.categories[preference.category];

    const filteredExplicit = bucket.explicit.filter(
      (item) =>
        item.id !== preference.id &&
        item.preference.toLowerCase() !== preference.preference.toLowerCase(),
    );
    const filteredTentative = bucket.tentative.filter(
      (item) =>
        item.id !== preference.id &&
        item.preference.toLowerCase() !== preference.preference.toLowerCase(),
    );

    if (preference.status === 'explicit') {
      filteredExplicit.push(preference);
    } else if (preference.status === 'tentative') {
      filteredTentative.push(preference);
    }

    const updated: DesignDna = {
      ...dna,
      updatedAt: nowIso(),
      categories: {
        ...dna.categories,
        [preference.category]: {
          explicit: filteredExplicit,
          tentative: filteredTentative,
        },
      },
    };

    await this.save(updated, expectedBaseHash);
    return updated;
  }

  listPreferences(
    dna: DesignDna,
  ): Array<PersonalPreference & { bucket: 'explicit' | 'tentative' }> {
    const result: Array<PersonalPreference & { bucket: 'explicit' | 'tentative' }> = [];
    const categories = Object.keys(dna.categories) as PreferenceCategory[];
    for (const category of categories) {
      const bucket = dna.categories[category];
      for (const item of bucket.explicit) {
        result.push({ ...item, bucket: 'explicit' });
      }
      for (const item of bucket.tentative) {
        result.push({ ...item, bucket: 'tentative' });
      }
    }
    return result;
  }
}
