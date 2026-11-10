import path from 'node:path';
import {
  type CreativeReference,
  type LicenseInformation,
  type SourceAttribution,
  type SourceType,
  ValidationError,
  type WorkspacePaths,
  createStableId,
  isWithinRoot,
  nowIso,
  sha256File,
  toPosixRelative,
} from '@aesthra/core';
import { ReferenceCatalogStore } from './catalog.js';
import { inferSourceTypeFromUrl, inspectLocalMediaFile } from './media.js';
import { validateAndNormalizeUrl } from './url.js';

export interface RegisterFileInput {
  filePath: string;
  sourceType?: SourceType;
  title?: string;
  description?: string;
  tags?: string[];
  notes?: string;
  sourceAttribution?: SourceAttribution;
  licenseInformation?: LicenseInformation;
}

export interface RegisterUrlInput {
  url: string;
  sourceType?: SourceType;
  title?: string;
  description?: string;
  tags?: string[];
  notes?: string;
  sourceAttribution?: SourceAttribution;
  licenseInformation?: LicenseInformation;
}

export interface RegisterReferenceResult {
  reference: CreativeReference;
  duplicate: boolean;
  matchedBy?: 'contentHash' | 'canonicalUrl';
}

function normalizeTags(tags?: string[]): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  for (const tag of tags) {
    const cleaned = tag.trim().toLowerCase();
    if (cleaned.length > 0) {
      seen.add(cleaned);
    }
  }
  return [...seen];
}

function deriveTitleFromPath(filePath: string): string {
  const base = path.basename(filePath, path.extname(filePath));
  return base.replace(/[-_]+/g, ' ').trim() || path.basename(filePath);
}

function deriveTitleFromUrl(urlString: string): string {
  const parsed = new URL(urlString);
  const pathPart = parsed.pathname.split('/').filter(Boolean).pop();
  if (pathPart) {
    return `${parsed.hostname} — ${pathPart}`;
  }
  return parsed.hostname;
}

export class IngestionService {
  public readonly catalog: ReferenceCatalogStore;

  constructor(private readonly paths: WorkspacePaths) {
    this.catalog = new ReferenceCatalogStore(paths);
  }

  async registerLocalFile(input: RegisterFileInput): Promise<RegisterReferenceResult> {
    const resolvedFile = path.resolve(this.paths.root, input.filePath);
    const { metadata, defaultSourceType } = await inspectLocalMediaFile(resolvedFile);
    const contentHash = await sha256File(resolvedFile);

    const existing = await this.catalog.findByContentHash(contentHash);
    if (existing) {
      return {
        reference: existing,
        duplicate: true,
        matchedBy: 'contentHash',
      };
    }

    const storedLocalPath = isWithinRoot(this.paths.root, resolvedFile)
      ? toPosixRelative(this.paths.root, resolvedFile)
      : resolvedFile;

    const timestamp = nowIso();
    const notesText = input.notes?.trim();

    const reference: CreativeReference = {
      id: createStableId('ref', contentHash),
      sourceType: input.sourceType ?? defaultSourceType,
      localPath: storedLocalPath,
      title: input.title?.trim() || deriveTitleFromPath(resolvedFile),
      description: input.description?.trim() ?? '',
      tags: normalizeTags(input.tags),
      sourceAttribution: input.sourceAttribution ?? {},
      ...(input.licenseInformation ? { licenseInformation: input.licenseInformation } : {}),
      contentHash,
      technicalMetadata: metadata,
      importedAt: timestamp,
      status: 'registered',
      userNotes: notesText
        ? [{ id: createStableId('note'), text: notesText, addedAt: timestamp }]
        : [],
      analysisIds: [],
    };

    await this.catalog.save(reference);
    return {
      reference,
      duplicate: false,
    };
  }

  async registerUrl(input: RegisterUrlInput): Promise<RegisterReferenceResult> {
    const { sourceUrl, canonicalUrl } = validateAndNormalizeUrl(input.url);

    const existing = await this.catalog.findByCanonicalUrl(canonicalUrl);
    if (existing) {
      return {
        reference: existing,
        duplicate: true,
        matchedBy: 'canonicalUrl',
      };
    }

    const timestamp = nowIso();
    const notesText = input.notes?.trim();

    const reference: CreativeReference = {
      id: createStableId('ref', canonicalUrl),
      sourceType: input.sourceType ?? inferSourceTypeFromUrl(canonicalUrl),
      sourceUrl,
      canonicalUrl,
      title: input.title?.trim() || deriveTitleFromUrl(canonicalUrl),
      description: input.description?.trim() ?? '',
      tags: normalizeTags(input.tags),
      sourceAttribution: input.sourceAttribution ?? {},
      ...(input.licenseInformation ? { licenseInformation: input.licenseInformation } : {}),
      importedAt: timestamp,
      status: 'registered',
      userNotes: notesText
        ? [{ id: createStableId('note'), text: notesText, addedAt: timestamp }]
        : [],
      analysisIds: [],
    };

    await this.catalog.save(reference);
    return {
      reference,
      duplicate: false,
    };
  }

  async addNote(referenceId: string, noteText: string): Promise<CreativeReference> {
    const trimmed = noteText.trim();
    if (!trimmed) {
      throw new ValidationError('Note text must not be empty.');
    }
    const existing = await this.catalog.getById(referenceId);
    const updated: CreativeReference = {
      ...existing,
      userNotes: [
        ...existing.userNotes,
        { id: createStableId('note'), text: trimmed, addedAt: nowIso() },
      ],
    };
    await this.catalog.save(updated);
    return updated;
  }

  async saveUpdatedReference(reference: CreativeReference): Promise<void> {
    await this.catalog.save(reference);
  }
}

