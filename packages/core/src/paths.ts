import fs from 'node:fs/promises';
import path from 'node:path';
import { PathSecurityError } from './errors.js';

function normalizeSlash(input: string): string {
  return input.replace(/\\/g, '/');
}

export function toPosixRelative(workspaceRoot: string, targetPath: string): string {
  const relative = path.relative(path.resolve(workspaceRoot), path.resolve(targetPath));
  return normalizeSlash(relative);
}

export function isWithinRoot(rootPath: string, candidatePath: string): boolean {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedCandidate = path.resolve(candidatePath);
  const rel = path.relative(resolvedRoot, resolvedCandidate);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

async function resolveExistingAncestorRealpath(targetPath: string): Promise<string> {
  let current = path.resolve(targetPath);
  for (;;) {
    try {
      return await fs.realpath(current);
    } catch {
      const parent = path.dirname(current);
      if (parent === current) {
        return current;
      }
      current = parent;
    }
  }
}

export async function resolveSafeTargetPath(
  workspaceRoot: string,
  targetRelativePath: string,
  allowedPrefixes?: readonly string[],
): Promise<string> {
  if (targetRelativePath.includes('\0')) {
    throw new PathSecurityError('Target path contains null bytes.', { targetRelativePath });
  }

  const trimmed = targetRelativePath.trim();
  if (trimmed.length === 0) {
    throw new PathSecurityError('Target path must not be empty.');
  }

  if (path.isAbsolute(trimmed) || path.win32.isAbsolute(trimmed) || /^[a-zA-Z]:/.test(trimmed)) {
    throw new PathSecurityError('Target path must be relative to the workspace root.', {
      targetRelativePath,
    });
  }

  const posixNormalized = path.posix.normalize(normalizeSlash(trimmed));
  if (posixNormalized === '..' || posixNormalized.startsWith('../') || posixNormalized === '.') {
    throw new PathSecurityError('Target path escapes or targets workspace root directly.', {
      targetRelativePath,
    });
  }

  if (allowedPrefixes && allowedPrefixes.length > 0) {
    const matchesAllowed = allowedPrefixes.some((prefix) => {
      const cleanPrefix = normalizeSlash(prefix).replace(/\/+$/, '');
      return posixNormalized === cleanPrefix || posixNormalized.startsWith(`${cleanPrefix}/`);
    });
    if (!matchesAllowed) {
      throw new PathSecurityError(
        `Target path "${posixNormalized}" is outside allowed workspace directories: ${allowedPrefixes.join(', ')}.`,
        { targetRelativePath: posixNormalized, allowedPrefixes },
      );
    }
  }

  const resolvedRoot = await fs.realpath(path.resolve(workspaceRoot));
  const candidate = path.resolve(resolvedRoot, posixNormalized);

  if (!isWithinRoot(resolvedRoot, candidate)) {
    throw new PathSecurityError('Resolved path escapes the workspace root.', {
      targetRelativePath: posixNormalized,
    });
  }

  const ancestorRealpath = await resolveExistingAncestorRealpath(candidate);
  if (!isWithinRoot(resolvedRoot, ancestorRealpath)) {
    throw new PathSecurityError('Resolved path traverses a symlink outside the workspace root.', {
      targetRelativePath: posixNormalized,
    });
  }

  return candidate;
}
