import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSkillsDirectory } from './validate-skills.js';

type SyncTarget = 'claude' | 'codex' | 'all';

interface SyncOptions {
  target: SyncTarget;
  check: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): SyncOptions {
  let target: SyncTarget = 'all';
  let check = false;
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') {
      check = true;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--target') {
      const val = argv[i + 1];
      if (val === 'claude' || val === 'codex' || val === 'all') {
        target = val;
        i++;
      } else {
        throw new Error(`Invalid --target "${val ?? ''}". Expected claude | codex | all.`);
      }
    }
  }

  return { target, check, dryRun };
}

function getTargetDirectories(repoRoot: string, target: SyncTarget): string[] {
  const dirs: string[] = [];
  if (target === 'claude' || target === 'all') {
    dirs.push(path.join(repoRoot, '.claude', 'skills'));
  }
  if (target === 'codex' || target === 'all') {
    dirs.push(path.join(repoRoot, '.agents', 'skills'));
  }
  return dirs;
}

async function copyDirectoryRecursive(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirectoryRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function listFilesRelative(rootDir: string, currentDir = rootDir): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(currentDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRelative(rootDir, full)));
    } else if (entry.isFile()) {
      files.push(path.relative(rootDir, full).replace(/\\/g, '/'));
    }
  }
  return files;
}

async function directoriesMatch(srcDir: string, destDir: string): Promise<boolean> {
  const srcFiles = await listFilesRelative(srcDir);
  const destFiles = await listFilesRelative(destDir);
  if (srcFiles.length !== destFiles.length) {
    return false;
  }
  for (let i = 0; i < srcFiles.length; i++) {
    const rel = srcFiles[i];
    if (!rel || rel !== destFiles[i]) {
      return false;
    }
    const [srcBuf, destBuf] = await Promise.all([
      fs.readFile(path.join(srcDir, rel)),
      fs.readFile(path.join(destDir, rel)),
    ]);
    if (!srcBuf.equals(destBuf)) {
      return false;
    }
  }
  return true;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, '..');
  const skillsRoot = path.join(repoRoot, 'skills');

  const validations = await validateSkillsDirectory(skillsRoot);
  const invalid = validations.filter((v) => v.errors.length > 0);
  if (invalid.length > 0) {
    for (const item of invalid) {
      process.stderr.write(`[FAIL] skills/${item.skillName}: ${item.errors.join('; ')}\n`);
    }
    process.exitCode = 1;
    return;
  }

  const targetRoots = getTargetDirectories(repoRoot, options.target);

  if (options.check) {
    let outOfSync = false;
    for (const targetRoot of targetRoots) {
      for (const skill of validations) {
        const destSkillDir = path.join(targetRoot, skill.skillName);
        const matches = await directoriesMatch(skill.skillDir, destSkillDir);
        if (!matches) {
          outOfSync = true;
          process.stderr.write(
            `[OUT OF SYNC] ${path.relative(repoRoot, destSkillDir)} differs from skills/${skill.skillName}\n`,
          );
        }
      }
    }
    if (outOfSync) {
      process.stderr.write('Run "pnpm sync:skills" to refresh agent skill mirrors.\n');
      process.exitCode = 1;
    } else {
      process.stdout.write('All agent skill mirrors are in sync.\n');
    }
    return;
  }

  for (const targetRoot of targetRoots) {
    const relRoot = path.relative(repoRoot, targetRoot).replace(/\\/g, '/');
    if (options.dryRun) {
      process.stdout.write(`[DRY-RUN] Would sync ${validations.length} skill(s) -> ${relRoot}/\n`);
      continue;
    }

    await fs.rm(targetRoot, { recursive: true, force: true });
    await fs.mkdir(targetRoot, { recursive: true });
    for (const skill of validations) {
      await copyDirectoryRecursive(skill.skillDir, path.join(targetRoot, skill.skillName));
    }
    process.stdout.write(`Synced ${validations.length} skill(s) from skills/ -> ${relRoot}/\n`);
  }
}

await main();

