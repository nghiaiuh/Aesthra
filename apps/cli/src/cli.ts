import { AesthraError } from '@aesthra/core';
import { Command, CommanderError } from 'commander';
import { runAnalyzeCommand, type AnalyzeCommandOptions } from './commands/analyze.js';
import { runApproveCommand, type ApproveCommandOptions } from './commands/approve.js';
import { runDoctorCommand } from './commands/doctor.js';
import { runInboxCommand, type InboxCommandOptions } from './commands/inbox.js';
import { runLearnCommand, type LearnCommandOptions } from './commands/learn.js';
import { runProfileCommand, type ProfileCommandOptions } from './commands/profile.js';
import { runProposeCommand, type ProposeCommandOptions } from './commands/propose.js';
import { runRejectCommand, type RejectCommandOptions } from './commands/reject.js';
import { runSearchCommand, type SearchCommandOptions } from './commands/search.js';
import { runShowCommand, type ShowCommandOptions } from './commands/show.js';
import { type CliRuntime, createCliRuntime } from './context.js';

export interface RunCliOptions {
  runtime?: CliRuntime;
  workspaceRoot?: string;
  writeOut?: (line: string) => void;
  writeErr?: (line: string) => void;
  isInteractive?: () => boolean;
  confirm?: (prompt: string) => Promise<boolean>;
}

export async function runCli(argv: string[], options?: RunCliOptions): Promise<number> {
  let exitCode = 0;
  const capturedWorkspaceRoot = options?.workspaceRoot;

  const getRuntime = async (program: Command): Promise<CliRuntime> => {
    if (options?.runtime) {
      return options.runtime;
    }
    const opts = program.opts<{ workspace?: string }>();
    return createCliRuntime({
      ...(opts.workspace
        ? { workspaceRoot: opts.workspace }
        : capturedWorkspaceRoot
          ? { workspaceRoot: capturedWorkspaceRoot }
          : {}),
      ...(options?.writeOut ? { writeOut: options.writeOut } : {}),
      ...(options?.writeErr ? { writeErr: options.writeErr } : {}),
      ...(options?.isInteractive ? { isInteractive: options.isInteractive } : {}),
      ...(options?.confirm ? { confirm: options.confirm } : {}),
    });
  };

  const writeOut = options?.writeOut ?? ((line: string) => process.stdout.write(`${line}\n`));
  const writeErr = options?.writeErr ?? ((line: string) => process.stderr.write(`${line}\n`));

  const program = new Command();
  program
    .name('aesthra')
    .description('Aesthra — Intelligence Shaped by Taste. Personal creative intelligence CLI.')
    .version('0.1.0')
    .option('-w, --workspace <path>', 'Path to Aesthra workspace root')
    .configureOutput({
      writeOut: (str) => {
        writeOut(str.replace(/\r?\n$/, ''));
      },
      writeErr: (str) => {
        writeErr(str.replace(/\r?\n$/, ''));
      },
    })
    .exitOverride();

  program.addHelpText(
    'after',
    `
Examples:
  $ pnpm brain learn --file ./examples/references/sample-poster.png --notes "Strong negative space"
  $ pnpm brain analyze ref_123456 --import ./examples/analyses/sample-poster-analysis.json
  $ pnpm brain propose ref_123456
  $ pnpm brain inbox
  $ pnpm brain show prop_123456
  $ pnpm brain approve prop_123456 --yes
  $ pnpm brain search "negative space"
  $ pnpm brain profile
  $ pnpm brain doctor
`,
  );

  program
    .command('learn')
    .description('Register a local creative reference or source URL into the catalog')
    .option('-f, --file <path>', 'Path to a local reference file')
    .option('-u, --url <url>', 'Source URL (metadata only; never scraped automatically)')
    .option('-t, --type <type>', 'Reference type: image | video | poster | website | other')
    .option('--title <title>', 'Human-readable title')
    .option('--description <text>', 'Short description')
    .option('--tags <comma-list>', 'Comma-separated tags')
    .option('--notes <text>', 'Personal observation or reason for saving')
    .option('--attribution <text>', 'Creator or source attribution')
    .option('--license <text>', 'Known license or usage note')
    .option('--json', 'Output JSON')
    .action(async (cmdOpts: LearnCommandOptions) => {
      const runtime = await getRuntime(program);
      await runLearnCommand(runtime, cmdOpts);
    });

  program
    .command('analyze <referenceId>')
    .description('Inspect available technical metadata or import a structured analysis JSON')
    .option('-i, --import <path>', 'Import structured analysis JSON file')
    .option('--require-vision', 'Fail if no vision-capable AI analyzer is configured')
    .option('--json', 'Output JSON')
    .action(async (referenceId: string, cmdOpts: AnalyzeCommandOptions) => {
      const runtime = await getRuntime(program);
      await runAnalyzeCommand(runtime, referenceId, cmdOpts);
    });

  program
    .command('propose <referenceId>')
    .description('Generate reviewable knowledge or preference proposals for the learning inbox')
    .option('--include-duplicates', 'Generate proposals even for duplicate patterns')
    .option('--prefer <statement>', 'Explicit personal preference to propose')
    .option('--avoid <statement>', 'Explicit personal negative preference to propose')
    .option('--category <category>', 'Preference category (used with --prefer or --avoid)')
    .option('--rationale <text>', 'Rationale for explicit preference')
    .option('--json', 'Output JSON')
    .action(async (referenceId: string, cmdOpts: ProposeCommandOptions) => {
      const runtime = await getRuntime(program);
      await runProposeCommand(runtime, referenceId, cmdOpts);
    });

  program
    .command('inbox')
    .description('List proposals in the learning inbox')
    .option(
      '--status <status>',
      'Filter by status: pending | approved | rejected | applied | failed',
    )
    .option('--all', 'Show all proposals regardless of status')
    .option('--json', 'Output JSON')
    .action(async (cmdOpts: InboxCommandOptions) => {
      const runtime = await getRuntime(program);
      await runInboxCommand(runtime, cmdOpts);
    });

  program
    .command('show <proposalId>')
    .description('Display full details, evidence, conflicts, and preview of a proposal')
    .option('--json', 'Output JSON')
    .action(async (proposalId: string, cmdOpts: ShowCommandOptions) => {
      const runtime = await getRuntime(program);
      await runShowCommand(runtime, proposalId, cmdOpts);
    });

  program
    .command('approve <proposalId>')
    .description('Approve and safely apply a pending proposal')
    .option('-y, --yes', 'Confirm non-interactive approval')
    .option('--confirm', 'Alias for --yes')
    .option('--note <text>', 'Optional review note recorded in decision history')
    .option('--json', 'Output JSON')
    .action(async (proposalId: string, cmdOpts: ApproveCommandOptions) => {
      const runtime = await getRuntime(program);
      await runApproveCommand(runtime, proposalId, cmdOpts);
    });

  program
    .command('reject <proposalId>')
    .description('Reject a pending proposal without modifying curated knowledge or memory')
    .option('-r, --reason <text>', 'Reason for rejecting the proposal')
    .option('--json', 'Output JSON')
    .action(async (proposalId: string, cmdOpts: RejectCommandOptions) => {
      const runtime = await getRuntime(program);
      await runRejectCommand(runtime, proposalId, cmdOpts);
    });

  program
    .command('search <query>')
    .description('Search approved creative knowledge (local keyword retrieval)')
    .option('-d, --domain <domain>', 'Filter by creative domain')
    .option('-t, --tag <tag>', 'Filter by tag')
    .option('--include-references', 'Include registered references in search')
    .option('--include-memory', 'Include personal preferences in search')
    .option('-l, --limit <count>', 'Maximum results to return')
    .option('--json', 'Output JSON')
    .action(async (query: string, cmdOpts: SearchCommandOptions) => {
      const runtime = await getRuntime(program);
      await runSearchCommand(runtime, query, cmdOpts);
    });

  program
    .command('profile')
    .description('Display the current Personal Design DNA profile')
    .option('--json', 'Output JSON')
    .action(async (cmdOpts: ProfileCommandOptions) => {
      const runtime = await getRuntime(program);
      await runProfileCommand(runtime, cmdOpts);
    });

  program
    .command('doctor')
    .description('Check Node.js, workspace directories, schemas, skills, and optional tools')
    .option('--json', 'Output JSON')
    .action(async (cmdOpts: { json?: boolean }) => {
      const runtime = await getRuntime(program);
      const report = await runDoctorCommand(runtime, cmdOpts);
      if (!report.healthy) {
        exitCode = 1;
      }
    });

  try {
    await program.parseAsync(argv);
    return exitCode;
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.exitCode;
    }
    if (error instanceof AesthraError) {
      writeErr(`Error [${error.code}]: ${error.message}`);
      return 1;
    }
    if (error instanceof Error) {
      writeErr(`Error: ${error.message}`);
      return 1;
    }
    writeErr(`Unexpected error: ${String(error)}`);
    return 1;
  }
}

export * from './context.js';
