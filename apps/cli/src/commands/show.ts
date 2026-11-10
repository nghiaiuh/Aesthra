import { type CliRuntime } from '../context.js';
import { formatProposalDetail } from '../output/formatters.js';

export interface ShowCommandOptions {
  json?: boolean;
}

export async function runShowCommand(
  runtime: CliRuntime,
  proposalId: string,
  options: ShowCommandOptions,
): Promise<void> {
  const proposal = await runtime.curator.inbox.getById(proposalId);
  if (options.json) {
    runtime.writeOut(JSON.stringify(proposal, null, 2));
    return;
  }
  runtime.writeOut(formatProposalDetail(proposal));
}

