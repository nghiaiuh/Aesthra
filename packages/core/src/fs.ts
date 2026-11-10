import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { type z } from 'zod';
import { ValidationError } from './errors.js';

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function writeTextAtomic(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  const tempPath = path.join(
    dir,
    `.${path.basename(filePath)}.tmp-${process.pid}-${randomBytes(4).toString('hex')}`,
  );
  await fs.writeFile(tempPath, content, 'utf8');
  try {
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  const formatted = `${JSON.stringify(data, null, 2)}\n`;
  await writeTextAtomic(filePath, formatted);
}

export async function readJsonFile<T>(filePath: string, schema: z.ZodType<T>): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new ValidationError(`Invalid JSON in "${filePath}".`, { filePath }, error);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new ValidationError(
      `Schema validation failed for "${filePath}": ${result.error.message}`,
      { filePath, issues: result.error.issues },
      result.error,
    );
  }
  return result.data;
}

export async function readYamlFile<T>(filePath: string, schema: z.ZodType<T>): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8');
  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (error) {
    throw new ValidationError(`Invalid YAML in "${filePath}".`, { filePath }, error);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new ValidationError(
      `Schema validation failed for "${filePath}": ${result.error.message}`,
      { filePath, issues: result.error.issues },
      result.error,
    );
  }
  return result.data;
}

export async function writeYamlAtomic(
  filePath: string,
  data: unknown,
  headerComment?: string,
): Promise<void> {
  const yamlBody = stringifyYaml(data, { lineWidth: 100 });
  const content = headerComment ? `${headerComment.trimEnd()}\n\n${yamlBody}` : yamlBody;
  await writeTextAtomic(filePath, content);
}

export async function readJsonlFile<T>(filePath: string, schema: z.ZodType<T>): Promise<T[]> {
  if (!(await fileExists(filePath))) {
    return [];
  }
  const raw = await fs.readFile(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const records: T[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]?.trim();
    if (!line) {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      throw new ValidationError(
        `Invalid JSONL at "${filePath}" line ${idx + 1}.`,
        { filePath, line: idx + 1 },
        error,
      );
    }
    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new ValidationError(
        `Schema validation failed at "${filePath}" line ${idx + 1}: ${result.error.message}`,
        { filePath, line: idx + 1, issues: result.error.issues },
        result.error,
      );
    }
    records.push(result.data);
  }

  return records;
}

export async function appendJsonlRecord<T>(
  filePath: string,
  record: T,
  schema: z.ZodType<T>,
): Promise<void> {
  const result = schema.safeParse(record);
  if (!result.success) {
    throw new ValidationError(
      `Cannot append invalid record to "${filePath}": ${result.error.message}`,
      { filePath, issues: result.error.issues },
      result.error,
    );
  }
  await ensureDir(path.dirname(filePath));
  await fs.appendFile(filePath, `${JSON.stringify(result.data)}\n`, 'utf8');
}

export async function sha256File(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const digest = createHash('sha256').update(buffer).digest('hex');
  return `sha256:${digest}`;
}

export function sha256Text(text: string): string {
  const digest = createHash('sha256').update(text, 'utf8').digest('hex');
  return `sha256:${digest}`;
}

