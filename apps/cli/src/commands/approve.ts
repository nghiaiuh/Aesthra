import { ValidationError } from '@aesthra/core';
import { type CliRuntime } from '../context.js';

export interface ApproveCommandOptions {
  yes?: boolean;
  confirm?: boolean;
  note?: string;
  json?: boolean;
}

export async function runApproveCommand(
  runtime: CliRuntime,
  proposalId: string,
  options: ApproveCommandOptions,
): Promise<void> {
  const proposal = await runtime.curator.inbox.getById(proposalId);
  const explicitFlag = Boolean(options.yes || options.confirm);

  if (!explicitFlag) {
    if (!runtime.isInteractive()) {
      throw new ValidationError(
        `Refusing non-interactive approval of "${proposalId}" without --yes (or --confirm). Inspect with "aesthra show ${proposalId}" first.`,
      );
    }
    const confirmed = await runtime.confirm(
      `Approve proposal "${proposal.id}" (${proposal.proposalType}: ${proposal.action} ${proposal.targetPath})?`,
    );
    if (!confirmed) {
      throw new ValidationError(
        `Approval cancelled by user; proposal "${proposal.id}" remains pending.`,
      );
    }
  }

  const applied = await runtime.curator.approveProposal(proposalId, {
    ...(options.note ? { reviewNote: options.note } : {}),
  });

  if (options.json) {
    runtime.writeOut(JSON.stringify(applied, null, 2));
    return;
  }

  runtime.writeOut(`Approved and applied proposal "${applied.id}" -> ${applied.targetPath}`);
}
