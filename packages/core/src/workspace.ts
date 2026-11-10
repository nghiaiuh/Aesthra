import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureDir, fileExists, writeTextAtomic, writeYamlAtomic } from './fs.js';
import { nowIso } from './ids.js';

export interface WorkspacePaths {
  root: string;
  knowledgeDir: string;
  memoryDir: string;
  designDnaPath: string;
  preferencesLogPath: string;
  feedbackLogPath: string;
  decisionsLogPath: string;
  referencesDir: string;
  catalogDir: string;
  analysesDir: string;
  collectionsDir: string;
  learningDir: string;
  inboxDir: string;
  skillsDir: string;
}

export function resolveWorkspacePaths(rootDir: string): WorkspacePaths {
  const root = path.resolve(rootDir);
  return {
    root,
    knowledgeDir: path.join(root, 'knowledge'),
    memoryDir: path.join(root, 'memory'),
    designDnaPath: path.join(root, 'memory', 'design-dna.yaml'),
    preferencesLogPath: path.join(root, 'memory', 'preferences.jsonl'),
    feedbackLogPath: path.join(root, 'memory', 'feedback.jsonl'),
    decisionsLogPath: path.join(root, 'memory', 'decisions.jsonl'),
    referencesDir: path.join(root, 'references'),
    catalogDir: path.join(root, 'references', 'catalog'),
    analysesDir: path.join(root, 'references', 'analyses'),
    collectionsDir: path.join(root, 'references', 'collections'),
    learningDir: path.join(root, 'learning'),
    inboxDir: path.join(root, 'learning', 'inbox'),
    skillsDir: path.join(root, 'skills'),
  };
}

export async function findWorkspaceRoot(startDir: string = process.cwd()): Promise<string> {
  const envHome = process.env['AESTHRA_HOME'];
  if (envHome && envHome.trim().length > 0) {
    return path.resolve(envHome.trim());
  }

  let current = path.resolve(startDir);
  for (;;) {
    const hasKnowledge = await fileExists(path.join(current, 'knowledge'));
    const hasMemory = await fileExists(path.join(current, 'memory'));
    const hasWorkspaceFile = await fileExists(path.join(current, 'pnpm-workspace.yaml'));

    if ((hasKnowledge && hasMemory) || (hasWorkspaceFile && hasKnowledge)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(startDir);
    }
    current = parent;
  }
}

export function createInitialDesignDna(timestamp: string = nowIso()) {
  return {
    schemaVersion: 1,
    owner: 'personal-profile',
    note: 'Personal creative taste profile. Only explicitly approved or stated preferences become established taste. General design knowledge lives separately in knowledge/.',
    updatedAt: timestamp,
    categories: {
      visual_identity: { explicit: [], tentative: [] },
      composition: { explicit: [], tentative: [] },
      typography: { explicit: [], tentative: [] },
      color: { explicit: [], tentative: [] },
      lighting: { explicit: [], tentative: [] },
      motion: { explicit: [], tentative: [] },
      cinematic_language: { explicit: [], tentative: [] },
      creative_influences: { explicit: [], tentative: [] },
      negative_preferences: { explicit: [], tentative: [] },
    },
  };
}

export async function ensureWorkspaceStructure(paths: WorkspacePaths): Promise<void> {
  const dirs = [
    paths.knowledgeDir,
    path.join(paths.knowledgeDir, 'foundations'),
    path.join(paths.knowledgeDir, 'cinematic'),
    path.join(paths.knowledgeDir, 'graphic-design'),
    path.join(paths.knowledgeDir, 'motion-design'),
    path.join(paths.knowledgeDir, 'patterns'),
    path.join(paths.knowledgeDir, 'styles'),
    path.join(paths.knowledgeDir, 'recipes'),
    paths.memoryDir,
    paths.catalogDir,
    paths.analysesDir,
    paths.collectionsDir,
    paths.inboxDir,
    paths.skillsDir,
  ];

  await Promise.all(dirs.map((dir) => ensureDir(dir)));

  if (!(await fileExists(paths.designDnaPath))) {
    await writeYamlAtomic(
      paths.designDnaPath,
      createInitialDesignDna(),
      '# Aesthra Personal Design DNA\n# General creative knowledge resides in knowledge/; personal taste resides here.',
    );
  }

  for (const logPath of [paths.preferencesLogPath, paths.feedbackLogPath, paths.decisionsLogPath]) {
    if (!(await fileExists(logPath))) {
      await writeTextAtomic(logPath, '');
    }
  }
}

export async function isDirectoryWritable(dirPath: string): Promise<boolean> {
  try {
    await fs.access(dirPath, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}
