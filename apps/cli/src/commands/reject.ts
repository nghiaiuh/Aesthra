import { type CliRuntime } from '../context.js';

export interface RejectCommandOptions {
  reason?: string;
  json?: boolean;
}

export async function runRejectCommand(
  runtime: CliRuntime,
  proposalId: string,
  options: RejectCommandOptions,
): Promise<void> {
  const rejected = await runtime.curator.rejectProposal(proposalId, {
    ...(options.reason ? { reviewNote: options.reason } : {}),
  });

  if (options.json) {
    runtime.writeOut(JSON.stringify(rejected, null, 2));
    return;
  }

  runtime.writeOut(
    `Rejected proposal "${rejected.id}". Curated knowledge and personal memory were not modified.`,
  );
}

