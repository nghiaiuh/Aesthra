import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import {
  type KnowledgePattern,
  KnowledgePatternSchema,
  ValidationError,
  sha256File,
  toPosixRelative,
} from '@aesthra/core';

export interface StoredKnowledgeEntry {
  pattern: KnowledgePattern;
  filePath: string;
  relativePath: string;
  fileHash: string;
}

function formatList(items: string[], emptyFallback: string): string {
  if (items.length === 0) {
    return `- ${emptyFallback}`;
  }
  return items.map((item) => `- ${item}`).join('\n');
}

export function serializeKnowledgePatternMarkdown(patternInput: KnowledgePattern): string {
  const pattern = KnowledgePatternSchema.parse(patternInput);

  const frontmatter = {
    id: pattern.id,
    name: pattern.name,
    category: pattern.category,
    domain: pattern.domain,
    summary: pattern.summary,
    tags: pattern.tags,
    origin: pattern.origin,
    sourceReferenceIds: pattern.sourceReferenceIds,
    relatedPatternIds: pattern.relatedPatternIds,
    confidence: pattern.confidence,
    status: pattern.status,
    createdAt: pattern.createdAt,
    updatedAt: pattern.updatedAt,
  };

  const yamlStr = stringifyYaml(frontmatter, { lineWidth: 100 }).trimEnd();

  const referenceLines =
    pattern.origin === 'illustrative_seed' && pattern.sourceReferenceIds.length === 0
      ? [
          'Illustrative initial knowledge entry (no external reference imported; provided as a format and domain baseline).',
        ]
      : pattern.sourceReferenceIds.length > 0
        ? pattern.sourceReferenceIds.map((id) => `\`${id}\``)
        : ['No external reference IDs linked.'];

  const relatedLines =
    pattern.relatedPatternIds.length > 0
      ? pattern.relatedPatternIds.map((id) => `\`${id}\``)
      : ['None linked yet.'];

  return [
    '---',
    yamlStr,
    '---',
    '',
    `# ${pattern.name}`,
    '',
    '## Summary',
    '',
    pattern.summary,
    '',
    '## Visual or Cinematic Principle',
    '',
    pattern.description,
    '',
    '## Why It Works',
    '',
    pattern.whyItWorks,
    '',
    '## Practical Application',
    '',
    formatList(pattern.useCases, 'General conceptual guidance.'),
    '',
    '## Constraints',
    '',
    formatList(pattern.constraints, 'No explicit constraints recorded.'),
    '',
    '## Common Mistakes',
    '',
    formatList(pattern.commonMistakes, 'No common mistakes recorded yet.'),
    '',
    '## References',
    '',
    formatList(referenceLines, 'None.'),
    '',
    '## Related Patterns',
    '',
    formatList(relatedLines, 'None.'),
    '',
  ].join('\n');
}

function extractSections(body: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = body.split(/\r?\n/);
  let currentHeading: string | null = null;
  let buffer: string[] = [];

  for (const line of lines) {
    const match = /^##\s+(.+?)\s*$/.exec(line);
    if (match?.[1]) {
      if (currentHeading !== null) {
        sections.set(currentHeading, buffer.join('\n').trim());
      }
      currentHeading = match[1].trim().toLowerCase();
      buffer = [];
    } else if (currentHeading !== null) {
      buffer.push(line);
    }
  }

  if (currentHeading !== null) {
    sections.set(currentHeading, buffer.join('\n').trim());
  }
  return sections;
}

function parseBulletSection(text: string | undefined): string[] {
  if (!text) return [];
  const items: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*[-*]\s+(.+?)\s*$/.exec(line);
    if (match?.[1]) {
      const value = match[1].trim();
      if (
        value !== 'No explicit constraints recorded.' &&
        value !== 'No common mistakes recorded yet.' &&
        value !== 'None linked yet.' &&
        value !== 'None.'
      ) {
        items.push(value);
      }
    }
  }
  return items;
}

export function parseKnowledgePatternMarkdown(
  markdown: string,
  filePathForErrors = '<memory>',
): KnowledgePattern {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(markdown);
  if (!match?.[1]) {
    throw new ValidationError(
      `Knowledge markdown "${filePathForErrors}" is missing YAML frontmatter.`,
    );
  }

  let frontmatterRaw: unknown;
  try {
    frontmatterRaw = parseYaml(match[1]);
  } catch (error) {
    throw new ValidationError(
      `Invalid YAML frontmatter in "${filePathForErrors}".`,
      { filePath: filePathForErrors },
      error,
    );
  }

  if (!frontmatterRaw || typeof frontmatterRaw !== 'object') {
    throw new ValidationError(`Frontmatter in "${filePathForErrors}" must be a YAML mapping.`);
  }

  const fm = frontmatterRaw as Record<string, unknown>;
  const sections = extractSections(match[2] ?? '');

  const summary =
    typeof fm['summary'] === 'string' && fm['summary'].trim().length > 0
      ? fm['summary'].trim()
      : (sections.get('summary') ?? '');

  const description =
    sections.get('visual or cinematic principle') ??
    sections.get('principle') ??
    sections.get('description') ??
    summary;

  const whyItWorks = sections.get('why it works') ?? summary;
  const useCases = parseBulletSection(sections.get('practical application'));
  const constraints = parseBulletSection(sections.get('constraints'));
  const commonMistakes = parseBulletSection(sections.get('common mistakes'));
  const principles = description
    .split(/\r?\n\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const candidate = {
    id: fm['id'],
    name: fm['name'],
    category: fm['category'],
    domain: fm['domain'],
    summary,
    description,
    principles: principles.length > 0 ? principles : [summary],
    whyItWorks,
    useCases: useCases.length > 0 ? useCases : [summary],
    constraints,
    commonMistakes,
    sourceReferenceIds: Array.isArray(fm['sourceReferenceIds']) ? fm['sourceReferenceIds'] : [],
    relatedPatternIds: Array.isArray(fm['relatedPatternIds']) ? fm['relatedPatternIds'] : [],
    tags: Array.isArray(fm['tags']) ? fm['tags'] : [],
    origin: fm['origin'] ?? 'learned_reference',
    confidence: fm['confidence'],
    status: fm['status'],
    createdAt: fm['createdAt'],
    updatedAt: fm['updatedAt'],
  };

  const result = KnowledgePatternSchema.safeParse(candidate);
  if (!result.success) {
    throw new ValidationError(
      `Invalid knowledge pattern schema in "${filePathForErrors}": ${result.error.message}`,
      { filePath: filePathForErrors, issues: result.error.issues },
      result.error,
    );
  }
  return result.data;
}

async function collectMarkdownFiles(dirPath: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(fullPath)));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.md') &&
      entry.name.toLowerCase() !== 'readme.md'
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

export async function loadKnowledgePatterns(
  workspaceRoot: string,
  knowledgeDir: string,
): Promise<StoredKnowledgeEntry[]> {
  const files = await collectMarkdownFiles(knowledgeDir);
  const results: StoredKnowledgeEntry[] = [];

  for (const filePath of files) {
    const content = await fs.readFile(filePath, 'utf8');
    const pattern = parseKnowledgePatternMarkdown(content, filePath);
    const fileHash = await sha256File(filePath);
    results.push({
      pattern,
      filePath,
      relativePath: toPosixRelative(workspaceRoot, filePath),
      fileHash,
    });
  }

  return results;
}
