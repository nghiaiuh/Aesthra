import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { getVisionProviderStatus, probeFfprobeAvailability } from '@aesthra/analysis';
import { fileExists, isDirectoryWritable } from '@aesthra/core';
import { parse as parseYaml } from 'yaml';
import { type CliRuntime } from '../context.js';

const execFileAsync = promisify(execFile);

export interface DoctorCheck {
  name: string;
  required: boolean;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface DoctorReport {
  healthy: boolean;
  workspaceRoot: string;
  checks: DoctorCheck[];
}

async function probeFfmpeg(): Promise<boolean> {
  const bin = process.env['FFMPEG_PATH']?.trim() || 'ffmpeg';
  try {
    await execFileAsync(bin, ['-version'], { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

async function validateSkillsDir(skillsDir: string): Promise<{ count: number; errors: string[] }> {
  let entries;
  try {
    entries = await fs.readdir(skillsDir, { withFileTypes: true });
  } catch {
    return { count: 0, errors: [`Skills directory missing: ${skillsDir}`] };
  }

  const errors: string[] = [];
  let count = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillMd = path.join(skillsDir, entry.name, 'SKILL.md');
    if (!(await fileExists(skillMd))) {
      errors.push(`Skill "${entry.name}" is missing SKILL.md`);
      continue;
    }
    const content = await fs.readFile(skillMd, 'utf8');
    const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
    if (!fmMatch?.[1]) {
      errors.push(`Skill "${entry.name}" SKILL.md lacks YAML frontmatter.`);
      continue;
    }
    try {
      const fm = parseYaml(fmMatch[1]) as Record<string, unknown>;
      if (fm['name'] !== entry.name) {
        errors.push(
          `Skill "${entry.name}" frontmatter name "${String(fm['name'])}" does not match folder.`,
        );
      } else if (typeof fm['description'] !== 'string' || fm['description'].trim().length === 0) {
        errors.push(`Skill "${entry.name}" frontmatter description is missing.`);
      } else {
        count++;
      }
    } catch (error) {
      errors.push(`Skill "${entry.name}" invalid YAML frontmatter: ${String(error)}`);
    }
  }

  return { count, errors };
}

export async function runDoctorCommand(
  runtime: CliRuntime,
  options: { json?: boolean },
): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];

  const majorVersion = Number(process.versions.node.split('.')[0]);
  checks.push({
    name: 'node-version',
    required: true,
    status: majorVersion >= 22 ? 'pass' : 'fail',
    detail: `Node.js ${process.version} (requires >=22.0.0)`,
  });

  const requiredDirs = [
    ['knowledge', runtime.paths.knowledgeDir],
    ['memory', runtime.paths.memoryDir],
    ['references/catalog', runtime.paths.catalogDir],
    ['references/analyses', runtime.paths.analysesDir],
    ['learning/inbox', runtime.paths.inboxDir],
  ] as const;

  for (const [label, dirPath] of requiredDirs) {
    const exists = await fileExists(dirPath);
    const writable = exists ? await isDirectoryWritable(dirPath) : false;
    checks.push({
      name: `dir:${label}`,
      required: true,
      status: exists && writable ? 'pass' : 'fail',
      detail: exists
        ? writable
          ? `Readable and writable (${dirPath})`
          : `Directory not writable (${dirPath})`
        : `Missing directory (${dirPath})`,
    });
  }

  try {
    const profile = await runtime.memory.getProfile();
    checks.push({
      name: 'memory-schema',
      required: true,
      status: 'pass',
      detail: `Design DNA valid (owner=${profile.designDna.owner}, preferences=${profile.preferences.length})`,
    });
  } catch (error) {
    checks.push({
      name: 'memory-schema',
      required: true,
      status: 'fail',
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  const knowledgeHealth = await runtime.curator.verifyKnowledgeHealth();
  checks.push({
    name: 'knowledge-schema',
    required: true,
    status: knowledgeHealth.errors.length === 0 ? 'pass' : 'fail',
    detail:
      knowledgeHealth.errors.length === 0
        ? `${knowledgeHealth.validCount} knowledge file(s) validated.`
        : knowledgeHealth.errors.join('; '),
  });

  const skillsHealth = await validateSkillsDir(runtime.paths.skillsDir);
  checks.push({
    name: 'skills',
    required: true,
    status: skillsHealth.errors.length === 0 ? 'pass' : 'fail',
    detail:
      skillsHealth.errors.length === 0
        ? `${skillsHealth.count} skill(s) validated in ${runtime.paths.skillsDir}`
        : skillsHealth.errors.join('; '),
  });

  const [hasFfmpeg, ffprobe] = await Promise.all([probeFfmpeg(), probeFfprobeAvailability()]);
  checks.push({
    name: 'optional:ffmpeg',
    required: false,
    status: hasFfmpeg && ffprobe.available ? 'pass' : 'warn',
    detail:
      hasFfmpeg && ffprobe.available
        ? 'ffmpeg and ffprobe detected (video metadata extraction available).'
        : 'ffmpeg/ffprobe not detected (optional; core image/JSON/knowledge workflows still work).',
  });

  const visionStatus = getVisionProviderStatus();
  checks.push({
    name: 'optional:vision-provider',
    required: false,
    status: visionStatus.configured ? 'pass' : 'warn',
    detail: visionStatus.reason,
  });

  const healthy = checks.every((c) => !c.required || c.status === 'pass');
  const report: DoctorReport = {
    healthy,
    workspaceRoot: runtime.paths.root,
    checks,
  };

  if (options.json) {
    runtime.writeOut(JSON.stringify(report, null, 2));
  } else {
    runtime.writeOut(`Aesthra Doctor — workspace: ${report.workspaceRoot}`);
    for (const check of report.checks) {
      const badge =
        check.status === 'pass' ? '[PASS]' : check.status === 'warn' ? '[WARN]' : '[FAIL]';
      const scope = check.required ? 'required' : 'optional';
      runtime.writeOut(`  ${badge} (${scope}) ${check.name}: ${check.detail}`);
    }
    runtime.writeOut('');
    runtime.writeOut(
      report.healthy
        ? 'Health check passed: all required systems ready.'
        : 'Health check failed: resolve [FAIL] items above.',
    );
  }

  return report;
}
