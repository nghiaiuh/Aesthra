import { type CreativeDomain } from '@aesthra/core';

export interface RetrievalQuery {
  query: string;
  domain?: CreativeDomain;
  tag?: string;
  includeReferences?: boolean;
  includeMemory?: boolean;
  limit?: number;
}

export interface RetrievalResultItem {
  kind: 'knowledge_pattern' | 'reference' | 'personal_preference';
  id: string;
  title: string;
  summary: string;
  score: number;
  domainOrCategory: string;
  tags: string[];
  path: string;
  matchedTerms: string[];
  provenance: string[];
}

export interface RetrievalResponse {
  retrievalMode: 'local_keyword';
  query: string;
  totalMatched: number;
  items: RetrievalResultItem[];
}

export interface KnowledgeRetriever {
  readonly mode: 'local_keyword';
  search(query: RetrievalQuery): Promise<RetrievalResponse>;
}

