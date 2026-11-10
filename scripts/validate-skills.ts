import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const REQUIRED_HEADINGS = ['when to use', 'inputs', 'workflow', 'outputs', 'constraints'];
const KEBAB_CASE_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface SkillValidationResult {
  skillName: string;
  skillDir: string;
  errors: string[];
}

function extractRelativeMarkdownLinks(markdown: string): string[] {
  const links: string[] = [];
  const regex = /\[[^\]]+\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown)) !== null) {
    const target = match[1]?.trim();
    if (
      target &&
      !target.startsWith('http://') &&
      !target.startsWith('https://') &&
      !target.startsWith('#')
    ) {
      links.push(target.split('#')[0] ?? target);
    }
  }
  return links;
}

export async function validateSkillsDirectory(
  skillsRoot: string,
): Promise<SkillValidationResult[]> {
  const entries = await fs.readdir(skillsRoot, { withFileTypes: true });
  const results: SkillValidationResult[] = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) {
      continue;
    }

    const skillDir = path.join(skillsRoot, entry.name);
    const skillFile = path.join(skillDir, 'SKILL.md');
    const errors: string[] = [];

    let raw: string;
    try {
      raw = await fs.readFile(skillFile, 'utf8');
    } catch {
      results.push({
        skillName: entry.name,
        skillDir,
        errors: [`Missing required file: ${skillFile}`],
      });
      continue;
    }

    const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
    if (!fmMatch?.[1]) {
      errors.push('SKILL.md must begin with valid YAML frontmatter delimited by ---');
    } else {
      let fm: unknown;
      try {
        fm = parseYaml(fmMatch[1]);
      } catch (error) {
        errors.push(`Invalid YAML frontmatter: ${String(error)}`);
      }

      if (fm && typeof fm === 'object') {
        const record = fm as Record<string, unknown>;
        const name = record['name'];
        const description = record['description'];

        if (typeof name !== 'string' || !KEBAB_CASE_REGEX.test(name)) {
          errors.push('Frontmatter "name" must be a non-empty kebab-case string.');
        } else if (name !== entry.name) {
          errors.push(
            `Frontmatter "name" ("${name}") must match directory name ("${entry.name}").`,
          );
        }

        if (typeof description !== 'string' || description.trim().length < 20) {
          errors.push('Frontmatter "description" must be at least 20 characters.');
        }
      } else if (fm !== undefined) {
        errors.push('Frontmatter must be a YAML mapping.');
      }

      const body = fmMatch[2] ?? '';
      const headings = [...body.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) =>
        (m[1] ?? '').trim().toLowerCase(),
      );
      for (const required of REQUIRED_HEADINGS) {
        if (!headings.includes(required)) {
          errors.push(`Missing required section "## ${required}" in SKILL.md.`);
        }
      }

      const relLinks = extractRelativeMarkdownLinks(body);
      for (const relLink of relLinks) {
        const resolved = path.resolve(skillDir, relLink);
        try {
          await fs.access(resolved);
        } catch {
          errors.push(`Broken relative reference link in SKILL.md: "${relLink}"`);
        }
      }
    }

    results.push({
      skillName: entry.name,
      skillDir,
      errors,
    });
  }

  return results;
}

async function main(): Promise<void> {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, '..');
  const skillsRoot = path.join(repoRoot, 'skills');

  const results = await validateSkillsDirectory(skillsRoot);
  if (results.length === 0) {
    process.stderr.write('No skills found under skills/.\n');
    process.exitCode = 1;
    return;
  }

  let hasErrors = false;
  for (const result of results) {
    if (result.errors.length === 0) {
      process.stdout.write(`[PASS] skills/${result.skillName}\n`);
    } else {
      hasErrors = true;
      process.stderr.write(`[FAIL] skills/${result.skillName}\n`);
      for (const err of result.errors) {
        process.stderr.write(`  - ${err}\n`);
      }
    }
  }

  if (hasErrors) {
    process.exitCode = 1;
  } else {
    process.stdout.write(`\nValidated ${results.length} skill(s) successfully.\n`);
  }
}

const isEntryPoint =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  await main();
}
