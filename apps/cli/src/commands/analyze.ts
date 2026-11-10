import { type CliRuntime } from '../context.js';
import { formatAnalysisSummary } from '../output/formatters.js';

export interface AnalyzeCommandOptions {
  import?: string;
  requireVision?: boolean;
  json?: boolean;
}

export async function runAnalyzeCommand(
  runtime: CliRuntime,
  referenceId: string,
  options: AnalyzeCommandOptions,
): Promise<void> {
  const result = options.import
    ? await runtime.analysis.importAnalysisFromFile(referenceId, options.import)
    : await runtime.analysis.analyzeReference(referenceId, {
        ...(options.requireVision ? { requireVision: true } : {}),
      });

  if (options.json) {
    runtime.writeOut(JSON.stringify(result, null, 2));
    return;
  }

  runtime.writeOut(result.message);
  runtime.writeOut('');
  runtime.writeOut(formatAnalysisSummary(result.analysis));
  runtime.writeOut('');
  runtime.writeOut('Next actions:');
  if (result.analysis.extractedPatterns.length > 0) {
    runtime.writeOut(`  - Generate reviewable proposals: aesthra propose ${referenceId}`);
  } else {
    runtime.writeOut(
      `  - Import structured visual analysis: aesthra analyze ${referenceId} --import <analysis.json>`,
    );
  }
}

