import { type CliRuntime } from '../context.js';
import { formatProfileSnapshot } from '../output/formatters.js';

export interface ProfileCommandOptions {
  json?: boolean;
}

export async function runProfileCommand(
  runtime: CliRuntime,
  options: ProfileCommandOptions,
): Promise<void> {
  const snapshot = await runtime.memory.getProfile();
  if (options.json) {
    runtime.writeOut(JSON.stringify(snapshot, null, 2));
    return;
  }
  runtime.writeOut(formatProfileSnapshot(snapshot));
}

