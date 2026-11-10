import { type WorkspacePaths } from '@aesthra/core';
import { LocalKeywordRetriever } from './keyword-retriever.js';
import { type KnowledgeRetriever, type RetrievalQuery, type RetrievalResponse } from './types.js';

export class RetrievalService {
  private readonly retriever: KnowledgeRetriever;

  constructor(paths: WorkspacePaths, retriever?: KnowledgeRetriever) {
    this.retriever = retriever ?? new LocalKeywordRetriever(paths);
  }

  async search(query: RetrievalQuery): Promise<RetrievalResponse> {
    return this.retriever.search(query);
  }
}

