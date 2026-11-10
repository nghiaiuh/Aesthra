import { PreferenceCategorySchema, PreferencePolaritySchema, ValidationError } from '@aesthra/core';
import { type ExplicitPreferenceInput } from '@aesthra/knowledge';
import { type CliRuntime } from '../context.js';
import { formatProposalRow } from '../output/formatters.js';

export interface ProposeCommandOptions {
  includeDuplicates?: boolean;
  prefer?: string;
  avoid?: string;
  category?: string;
  rationale?: string;
  json?: boolean;
}

export async function runProposeCommand(
  runtime: CliRuntime,
  referenceId: string,
  options: ProposeCommandOptions,
): Promise<void> {
  if (options.prefer && options.avoid) {
    throw new ValidationError('Specify either --prefer or --avoid, not both.');
  }

  let explicitPreference: ExplicitPreferenceInput | undefined;
  if (options.prefer || options.avoid) {
    const categoryRaw = options.category ?? 'visual_identity';
    const parsedCat = PreferenceCategorySchema.safeParse(categoryRaw);
    if (!parsedCat.success) {
      throw new ValidationError(
        `Invalid --category "${categoryRaw}". Allowed: ${PreferenceCategorySchema.options.join(', ')}.`,
      );
    }
    const polarity = PreferencePolaritySchema.parse(options.prefer ? 'prefer' : 'avoid');
    const statement = (options.prefer ?? options.avoid ?? '').trim();
    if (!statement) {
      throw new ValidationError('Preference text must not be empty.');
    }
    explicitPreference = {
      category: parsedCat.data,
      preference: statement,
      polarity,
      ...(options.rationale ? { rationale: options.rationale } : {}),
    };
  }

  const report = await runtime.curator.generateProposalsForReference(referenceId, {
    ...(options.includeDuplicates ? { includeDuplicates: true } : {}),
    ...(explicitPreference ? { explicitPreference } : {}),
  });

  if (options.json) {
    runtime.writeOut(JSON.stringify(report, null, 2));
    return;
  }

  if (report.insufficientEvidence) {
    runtime.writeOut(`Insufficient evidence for "${referenceId}": ${report.reason ?? ''}`);
    return;
  }

  if (report.skippedDuplicates.length > 0) {
    runtime.writeOut('Skipped duplicate candidate patterns:');
    for (const dup of report.skippedDuplicates) {
      runtime.writeOut(`  - ${dup.candidateName} -> matches ${dup.matchedId} (${dup.targetPath})`);
    }
  }

  if (report.proposals.length === 0) {
    runtime.writeOut(report.reason ?? 'No proposals generated.');
    return;
  }

  runtime.writeOut(`Generated ${report.proposals.length} proposal(s) in learning inbox:`);
  for (const proposal of report.proposals) {
    runtime.writeOut(`  ${formatProposalRow(proposal)}`);
  }
  runtime.writeOut('');
  runtime.writeOut('Next actions:');
  runtime.writeOut('  - Inspect inbox:   aesthra inbox');
  runtime.writeOut(
    `  - Inspect details: aesthra show ${report.proposals[0]?.id ?? '<proposal-id>'}`,
  );
}
