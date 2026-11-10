import { SourceTypeSchema, ValidationError } from '@aesthra/core';
import { type CliRuntime } from '../context.js';
import { formatReferenceSummary } from '../output/formatters.js';

export interface LearnCommandOptions {
  file?: string;
  url?: string;
  type?: string;
  title?: string;
  description?: string;
  tags?: string;
  notes?: string;
  attribution?: string;
  license?: string;
  json?: boolean;
}

export async function runLearnCommand(
  runtime: CliRuntime,
  options: LearnCommandOptions,
): Promise<void> {
  if ((options.file && options.url) || (!options.file && !options.url)) {
    throw new ValidationError(
      'Specify exactly one of --file <path> or --url <url> when registering a reference.',
    );
  }

  let sourceType;
  if (options.type) {
    const parsedType = SourceTypeSchema.safeParse(options.type);
    if (!parsedType.success) {
      throw new ValidationError(
        `Invalid --type "${options.type}". Allowed: ${SourceTypeSchema.options.join(', ')}.`,
      );
    }
    sourceType = parsedType.data;
  }

  const tags = options.tags
    ? options.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : undefined;

  const sourceAttribution = options.attribution
    ? { attributionText: options.attribution.trim() }
    : undefined;

  const licenseInformation = options.license
    ? { license: options.license.trim(), permissionStatus: 'reference_only' as const }
    : undefined;

  const sharedInput = {
    ...(sourceType ? { sourceType } : {}),
    ...(options.title ? { title: options.title } : {}),
    ...(options.description ? { description: options.description } : {}),
    ...(tags ? { tags } : {}),
    ...(options.notes ? { notes: options.notes } : {}),
    ...(sourceAttribution
      ? { sourceAttribution: { note: sourceAttribution.attributionText } }
      : {}),
    ...(licenseInformation ? { licenseInformation } : {}),
  };

  const result = options.file
    ? await runtime.ingestion.registerLocalFile({ filePath: options.file, ...sharedInput })
    : await runtime.ingestion.registerUrl({ url: options.url ?? '', ...sharedInput });

  if (options.json) {
    runtime.writeOut(JSON.stringify(result, null, 2));
    return;
  }

  if (result.duplicate) {
    runtime.writeOut(
      `Duplicate detected (matched by ${result.matchedBy}). Existing reference preserved:`,
    );
  } else {
    runtime.writeOut('Registered new creative reference:');
  }
  runtime.writeOut(formatReferenceSummary(result.reference));
  runtime.writeOut('');
  runtime.writeOut('Next actions:');
  runtime.writeOut(`  - Inspect technical metadata: aesthra analyze ${result.reference.id}`);
  runtime.writeOut(
    `  - Import structured analysis: aesthra analyze ${result.reference.id} --import <analysis.json>`,
  );
}
