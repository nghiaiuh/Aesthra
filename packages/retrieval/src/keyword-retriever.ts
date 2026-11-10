import { type WorkspacePaths } from '@aesthra/core';
import { ReferenceCatalogStore } from '@aesthra/ingestion';
import { loadKnowledgePatterns } from '@aesthra/knowledge';
import { MemoryService } from '@aesthra/memory';
import {
  type KnowledgeRetriever,
  type RetrievalQuery,
  type RetrievalResponse,
  type RetrievalResultItem,
} from './types.js';

function tokenizeQuery(input: string): string[] {
  return [
    ...new Set(
      input
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2),
    ),
  ];
}

function scoreField(text: string, tokens: string[], weight: number, matched: Set<string>): number {
  if (!text) return 0;
  const lower = text.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (lower.includes(token)) {
      score += weight;
      matched.add(token);
    }
  }
  return score;
}

export class LocalKeywordRetriever implements KnowledgeRetriever {
  public readonly mode = 'local_keyword' as const;
  private readonly catalog: ReferenceCatalogStore;
  private readonly memory: MemoryService;

  constructor(private readonly paths: WorkspacePaths) {
    this.catalog = new ReferenceCatalogStore(paths);
    this.memory = new MemoryService(paths);
  }

  async search(request: RetrievalQuery): Promise<RetrievalResponse> {
    const queryText = request.query.trim();
    const tokens = tokenizeQuery(queryText);
    const phrase = queryText.toLowerCase();
    const limit = request.limit ?? 10;

    const results: RetrievalResultItem[] = [];

    const knowledgeEntries = await loadKnowledgePatterns(this.paths.root, this.paths.knowledgeDir);
    for (const entry of knowledgeEntries) {
      const { pattern, relativePath } = entry;
      if (pattern.status !== 'approved') {
        continue;
      }
      if (request.domain && pattern.domain !== request.domain) {
        continue;
      }
      if (request.tag && !pattern.tags.includes(request.tag.toLowerCase())) {
        continue;
      }

      if (tokens.length === 0) {
        results.push({
          kind: 'knowledge_pattern',
          id: pattern.id,
          title: pattern.name,
          summary: pattern.summary,
          score: 1,
          domainOrCategory: `${pattern.category}/${pattern.domain}`,
          tags: pattern.tags,
          path: relativePath,
          matchedTerms: [],
          provenance:
            pattern.sourceReferenceIds.length > 0 ? pattern.sourceReferenceIds : [pattern.origin],
        });
        continue;
      }

      const matched = new Set<string>();
      let score = 0;
      score += scoreField(pattern.name, tokens, 3.0, matched);
      score += scoreField(pattern.tags.join(' '), tokens, 2.5, matched);
      score += scoreField(pattern.summary, tokens, 2.0, matched);
      score += scoreField(`${pattern.category} ${pattern.domain}`, tokens, 1.5, matched);
      score += scoreField(
        [pattern.description, pattern.whyItWorks, ...pattern.useCases, ...pattern.constraints].join(
          ' ',
        ),
        tokens,
        1.0,
        matched,
      );

      if (
        phrase.length >= 3 &&
        `${pattern.name} ${pattern.summary} ${pattern.description}`.toLowerCase().includes(phrase)
      ) {
        score += 2.5;
      }

      if (score > 0) {
        results.push({
          kind: 'knowledge_pattern',
          id: pattern.id,
          title: pattern.name,
          summary: pattern.summary,
          score: Number(score.toFixed(2)),
          domainOrCategory: `${pattern.category}/${pattern.domain}`,
          tags: pattern.tags,
          path: relativePath,
          matchedTerms: [...matched],
          provenance:
            pattern.sourceReferenceIds.length > 0 ? pattern.sourceReferenceIds : [pattern.origin],
        });
      }
    }

    if (request.includeReferences) {
      const refs = await this.catalog.list();
      for (const ref of refs) {
        if (request.tag && !ref.tags.includes(request.tag.toLowerCase())) {
          continue;
        }

        const matched = new Set<string>();
        const notesText = ref.userNotes.map((n) => n.text).join(' ');
        let score = 0;
        if (tokens.length === 0) {
          score = 0.5;
        } else {
          score += scoreField(ref.title, tokens, 2.5, matched);
          score += scoreField(ref.tags.join(' '), tokens, 2.0, matched);
          score += scoreField(`${ref.description} ${notesText}`, tokens, 1.2, matched);
        }

        if (score > 0) {
          results.push({
            kind: 'reference',
            id: ref.id,
            title: ref.title,
            summary:
              ref.description ||
              ref.userNotes[0]?.text ||
              `${ref.sourceType} reference (${ref.status})`,
            score: Number(score.toFixed(2)),
            domainOrCategory: `reference/${ref.sourceType}`,
            tags: ref.tags,
            path: `references/catalog/${ref.id}.json`,
            matchedTerms: [...matched],
            provenance: [ref.localPath ?? ref.sourceUrl ?? ref.id],
          });
        }
      }
    }

    if (request.includeMemory) {
      const profile = await this.memory.getProfile();
      for (const pref of profile.preferences) {
        const matched = new Set<string>();
        let score = 0;
        if (tokens.length === 0) {
          score = 0.5;
        } else {
          score += scoreField(pref.preference, tokens, 2.2, matched);
          score += scoreField(pref.category, tokens, 1.5, matched);
          score += scoreField(pref.evidence.join(' '), tokens, 1.0, matched);
        }
        if (score > 0) {
          results.push({
            kind: 'personal_preference',
            id: pref.id,
            title: `[${pref.polarity}/${pref.status}] ${pref.preference}`,
            summary: pref.evidence[0] ?? 'Personal Design DNA preference',
            score: Number(score.toFixed(2)),
            domainOrCategory: `memory/${pref.category}`,
            tags: [pref.polarity, pref.status],
            path: 'memory/design-dna.yaml',
            matchedTerms: [...matched],
            provenance: pref.sourceFeedbackIds,
          });
        }
      }
    }

    results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

    return {
      retrievalMode: this.mode,
      query: queryText,
      totalMatched: results.length,
      items: results.slice(0, limit),
    };
  }
}
