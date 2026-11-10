import { createHash, randomBytes } from 'node:crypto';
import { ValidationError } from './errors.js';

export function nowIso(): string {
  return new Date().toISOString();
}

export function createStableId(prefix: string, seed?: string): string {
  if (seed !== undefined && seed.trim().length > 0) {
    const hash = createHash('sha256').update(seed).digest('hex').slice(0, 12);
    return `${prefix}_${hash}`;
  }
  const randomPart = randomBytes(6).toString('hex');
  return `${prefix}_${randomPart}`;
}

export function slugify(input: string): string {
  const normalized = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  if (normalized.length === 0) {
    throw new ValidationError(`Cannot derive a valid slug from "${input}".`);
  }

  return normalized;
}

