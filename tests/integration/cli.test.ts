import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli } from '../../apps/cli/src/cli.js';
import { createMinimalPngBuffer, createTempWorkspace } from '../fixtures/helpers.js';

interface CapturedRun {
  code: number;
  stdout: string;
  stderr: string;
}

async function execCli(
  args: string[],
  options: {
    workspaceRoot: string;
    isInteractive?: () => boolean;
    confirm?: (prompt: string) => Promise<boolean>;
  },
): Promise<CapturedRun> {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runCli(['node', 'aesthra', ...args], {
    workspaceRoot: options.workspaceRoot,
    writeOut: (line) => out.push(line),
    writeErr: (line) => err.push(line),
    ...(options.isInteractive ? { isInteractive: options.isInteractive } : {}),
    ...(options.confirm ? { confirm: options.confirm } : {}),
  });
  return {
    code,
    stdout: out.join('\n'),
    stderr: err.join('\n'),
  };
}

describe('CLI Commands', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      await cleanups.pop()?.();
    }
  });

  it('displays help text and validates invalid arguments with nonzero exit codes', async () => {
    const ws = await createTempWorkspace();
    cleanups.push(ws.cleanup);

    const help = await execCli(['--help'], { workspaceRoot: ws.root });
    expect(help.code).toBe(0);
    expect(help.stdout).toContain('Usage: aesthra');
    expect(help.stdout).toContain('learn');
    expect(help.stdout).toContain('doctor');

    const badLearn = await execCli(['learn'], { workspaceRoot: ws.root });
    expect(badLearn.code).not.toBe(0);
    expect(badLearn.stderr).toContain('Specify exactly one of --file <path> or --url <url>');

    const badType = await execCli(
      ['learn', '--url', 'https://example.com/a', '--type', 'invalid_type'],
      { workspaceRoot: ws.root },
    );
    expect(badType.code).not.toBe(0);
    expect(badType.stderr).toContain('Invalid --type');

    const badSearch = await execCli(['search', 'lighting', '--domain', 'not_a_domain'], {
      workspaceRoot: ws.root,
    });
    expect(badSearch.code).not.toBe(0);
    expect(badSearch.stderr).toContain('Invalid --domain');
  });

  it('executes full CLI workflow: learn -> analyze -> propose -> inbox -> show -> approve/reject -> search -> profile -> doctor', async () => {
    const ws = await createTempWorkspace();
    cleanups.push(ws.cleanup);

    // Copy skills into temp workspace so doctor validates skills cleanly
    const repoSkillsDir = path.resolve(process.cwd(), 'skills');
    await fs.cp(repoSkillsDir, ws.paths.skillsDir, { recursive: true });

    const posterPath = path.join(ws.root, 'sample.png');
    await fs.writeFile(posterPath, createMinimalPngBuffer(600, 800));

    // 1. Learn
    const learnRes = await execCli(
      [
        'learn',
        '--file',
        posterPath,
        '--notes',
        'High-contrast editorial spacing',
        '--tags',
        'editorial,poster',
        '--json',
      ],
      { workspaceRoot: ws.root },
    );
    expect(learnRes.code).toBe(0);
    const learnData = JSON.parse(learnRes.stdout) as { reference: { id: string } };
    const refId = learnData.reference.id;
    expect(refId).toMatch(/^ref_/);

    // 2. Analyze without --import (metadata only, honest vision limitation)
    const metaAnalyze = await execCli(['analyze', refId], { workspaceRoot: ws.root });
    expect(metaAnalyze.code).toBe(0);
    expect(metaAnalyze.stdout).toContain('No vision-capable AI provider is configured');

    // 3. Analyze with --import
    const analysisPath = path.join(ws.root, 'analysis.json');
    await fs.writeFile(
      analysisPath,
      JSON.stringify({
        observations: [
          {
            dimension: 'lighting',
            statement: 'Directional key light casts soft shadow across right edge.',
            evidenceType: 'user_observation',
          },
        ],
        extractedPatterns: [
          {
            name: 'Directional Grazing Light',
            category: 'cinematic',
            domain: 'cinematic',
            summary: 'Side-skimming key light revealing material texture before full exposure.',
            principle: 'Place a soft directional key light at 75-90 degrees off camera axis.',
            whyItWorks: 'Creates sculptural micro-contrast and depth on matte surfaces.',
            useCases: ['Product reveal shots', 'Architectural portraits'],
            constraints: ['Avoid flattening with bright frontal fill.'],
            commonMistakes: ['Over-exposing specular highlights.'],
            tags: ['cinematic', 'lighting', 'texture'],
            confidence: 0.9,
          },
        ],
      }),
    );

    const importAnalyze = await execCli(['analyze', refId, '--import', analysisPath], {
      workspaceRoot: ws.root,
    });
    expect(importAnalyze.code).toBe(0);
    expect(importAnalyze.stdout).toContain('Imported structured analysis');

    // 4. Propose
    const proposeRes = await execCli(['propose', refId, '--json'], { workspaceRoot: ws.root });
    expect(proposeRes.code).toBe(0);
    const proposeData = JSON.parse(proposeRes.stdout) as {
      proposals: Array<{ id: string }>;
    };
    const propId = proposeData.proposals[0]?.id;
    expect(propId).toMatch(/^prop_/);
    if (!propId) return;

    // 5. Inbox and Show
    const inboxRes = await execCli(['inbox'], { workspaceRoot: ws.root });
    expect(inboxRes.code).toBe(0);
    expect(inboxRes.stdout).toContain(propId);

    const showRes = await execCli(['show', propId], { workspaceRoot: ws.root });
    expect(showRes.code).toBe(0);
    expect(showRes.stdout).toContain('Directional Grazing Light');

    // 6. Non-interactive approve MUST fail without --yes
    const unsafeApprove = await execCli(['approve', propId], {
      workspaceRoot: ws.root,
      isInteractive: () => false,
    });
    expect(unsafeApprove.code).not.toBe(0);
    expect(unsafeApprove.stderr).toContain('--yes');

    // 7. Approve with --yes
    const safeApprove = await execCli(['approve', propId, '--yes'], {
      workspaceRoot: ws.root,
      isInteractive: () => false,
    });
    expect(safeApprove.code).toBe(0);
    expect(safeApprove.stdout).toContain('Approved and applied proposal');

    // 8. Search
    const searchRes = await execCli(['search', 'grazing light'], { workspaceRoot: ws.root });
    expect(searchRes.code).toBe(0);
    expect(searchRes.stdout).toContain('Directional Grazing Light');
    expect(searchRes.stdout).toContain('local_keyword');

    // 9. Propose preference and reject it
    const prefPropose = await execCli(
      ['propose', refId, '--prefer', 'Soft grazing lighting', '--category', 'lighting', '--json'],
      { workspaceRoot: ws.root },
    );
    expect(prefPropose.code).toBe(0);
    const prefPropData = JSON.parse(prefPropose.stdout) as {
      proposals: Array<{ id: string; proposalType: string }>;
    };
    const prefPropId = prefPropData.proposals.find((p) => p.proposalType === 'preference')?.id;
    expect(prefPropId).toBeDefined();
    if (!prefPropId) return;

    const rejectRes = await execCli(['reject', prefPropId, '--reason', 'Wait for more examples'], {
      workspaceRoot: ws.root,
    });
    expect(rejectRes.code).toBe(0);
    expect(rejectRes.stdout).toContain('Rejected proposal');

    // 10. Profile
    const profileRes = await execCli(['profile'], { workspaceRoot: ws.root });
    expect(profileRes.code).toBe(0);
    expect(profileRes.stdout).toContain('Active preferences: 0');

    // 11. Doctor
    const doctorRes = await execCli(['doctor'], { workspaceRoot: ws.root });
    expect(doctorRes.code).toBe(0);
    expect(doctorRes.stdout).toContain('Health check passed');
  });
});
