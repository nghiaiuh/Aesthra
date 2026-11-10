import { type ProposalStatus, ProposalStatusSchema, ValidationError } from '@aesthra/core';
import { type CliRuntime } from '../context.js';
import { formatProposalRow } from '../output/formatters.js';

export interface InboxCommandOptions {
  status?: string;
  all?: boolean;
  json?: boolean;
}

export async function runInboxCommand(
  runtime: CliRuntime,
  options: InboxCommandOptions,
): Promise<void> {
  let statusFilter: ProposalStatus | undefined = 'pending';
  if (options.all) {
    statusFilter = undefined;
  } else if (options.status) {
    const parsed = ProposalStatusSchema.safeParse(options.status);
    if (!parsed.success) {
      throw new ValidationError(
        `Invalid --status "${options.status}". Allowed: ${ProposalStatusSchema.options.join(', ')}.`,
      );
    }
    statusFilter = parsed.data;
  }

  const proposals = await runtime.curator.inbox.list(
    statusFilter ? { status: statusFilter } : undefined,
  );

  if (options.json) {
    runtime.writeOut(JSON.stringify(proposals, null, 2));
    return;
  }

  if (proposals.length === 0) {
    runtime.writeOut(
      statusFilter ? `No proposals with status "${statusFilter}".` : 'Learning inbox is empty.',
    );
    return;
  }

  runtime.writeOut(
    `Learning Inbox (${proposals.length} proposal(s)${statusFilter ? `, status=${statusFilter}` : ''}):`,
  );
  for (const proposal of proposals) {
    runtime.writeOut(`  ${formatProposalRow(proposal)}`);
  }
}

