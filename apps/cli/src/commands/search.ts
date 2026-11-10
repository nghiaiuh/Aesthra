import { CreativeDomainSchema, ValidationError } from '@aesthra/core';
import { type CliRuntime } from '../context.js';
import { formatSearchResults } from '../output/formatters.js';

export interface SearchCommandOptions {
  domain?: string;
  tag?: string;
  includeReferences?: boolean;
  includeMemory?: boolean;
  limit?: string;
  json?: boolean;
}

export async function runSearchCommand(
  runtime: CliRuntime,
  query: string,
  options: SearchCommandOptions,
): Promise<void> {
  let domain;
  if (options.domain) {
    const parsedDomain = CreativeDomainSchema.safeParse(options.domain);
    if (!parsedDomain.success) {
      throw new ValidationError(
        `Invalid --domain "${options.domain}". Allowed: ${CreativeDomainSchema.options.join(', ')}.`,
      );
    }
    domain = parsedDomain.data;
  }

  let limit: number | undefined;
  if (options.limit !== undefined) {
    const num = Number(options.limit);
    if (!Number.isInteger(num) || num <= 0) {
      throw new ValidationError(`Invalid --limit "${options.limit}". Must be a positive integer.`);
    }
    limit = num;
  }

  const results = await runtime.retrieval.search({
    query,
    ...(domain ? { domain } : {}),
    ...(options.tag ? { tag: options.tag } : {}),
    ...(options.includeReferences ? { includeReferences: true } : {}),
    ...(options.includeMemory ? { includeMemory: true } : {}),
    ...(limit !== undefined ? { limit } : {}),
  });

  if (options.json) {
    runtime.writeOut(JSON.stringify(results, null, 2));
    return;
  }

  runtime.writeOut(formatSearchResults(results));
}

