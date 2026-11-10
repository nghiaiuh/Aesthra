import readline from 'node:readline/promises';
import { AnalysisService } from '@aesthra/analysis';
import { type WorkspacePaths, findWorkspaceRoot, resolveWorkspacePaths } from '@aesthra/core';
import { IngestionService } from '@aesthra/ingestion';
import { KnowledgeCurator } from '@aesthra/knowledge';
import { MemoryService } from '@aesthra/memory';
import { RetrievalService } from '@aesthra/retrieval';

export interface CliRuntime {
  paths: WorkspacePaths;
  writeOut: (line: string) => void;
  writeErr: (line: string) => void;
  isInteractive: () => boolean;
  confirm: (prompt: string) => Promise<boolean>;
  ingestion: IngestionService;
  analysis: AnalysisService;
  curator: KnowledgeCurator;
  memory: MemoryService;
  retrieval: RetrievalService;
}

export async function createCliRuntime(options?: {
  workspaceRoot?: string;
  writeOut?: (line: string) => void;
  writeErr?: (line: string) => void;
  isInteractive?: () => boolean;
  confirm?: (prompt: string) => Promise<boolean>;
}): Promise<CliRuntime> {
  const root = options?.workspaceRoot ?? (await findWorkspaceRoot());
  const paths = resolveWorkspacePaths(root);

  const writeOut = options?.writeOut ?? ((line: string) => process.stdout.write(`${line}\n`));
  const writeErr = options?.writeErr ?? ((line: string) => process.stderr.write(`${line}\n`));
  const isInteractive =
    options?.isInteractive ?? (() => process.stdin.isTTY && process.stdout.isTTY);

  const confirm =
    options?.confirm ??
    (async (prompt: string): Promise<boolean> => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      try {
        const answer = await rl.question(`${prompt} [y/N] `);
        return answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes';
      } finally {
        rl.close();
      }
    });

  return {
    paths,
    writeOut,
    writeErr,
    isInteractive,
    confirm,
    ingestion: new IngestionService(paths),
    analysis: new AnalysisService(paths),
    curator: new KnowledgeCurator(paths),
    memory: new MemoryService(paths),
    retrieval: new RetrievalService(paths),
  };
}
