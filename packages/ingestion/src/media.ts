import fs from 'node:fs/promises';
import path from 'node:path';
import { type SourceType, type TechnicalMetadata, ValidationError } from '@aesthra/core';

interface SupportedExtensionSpec {
  mimeType: string;
  defaultSourceType: SourceType;
  category: 'image' | 'video' | 'document';
}

const SUPPORTED_EXTENSIONS: Record<string, SupportedExtensionSpec> = {
  '.png': { mimeType: 'image/png', defaultSourceType: 'image', category: 'image' },
  '.jpg': { mimeType: 'image/jpeg', defaultSourceType: 'image', category: 'image' },
  '.jpeg': { mimeType: 'image/jpeg', defaultSourceType: 'image', category: 'image' },
  '.webp': { mimeType: 'image/webp', defaultSourceType: 'image', category: 'image' },
  '.gif': { mimeType: 'image/gif', defaultSourceType: 'image', category: 'image' },
  '.svg': { mimeType: 'image/svg+xml', defaultSourceType: 'image', category: 'image' },
  '.mp4': { mimeType: 'video/mp4', defaultSourceType: 'video', category: 'video' },
  '.mov': { mimeType: 'video/quicktime', defaultSourceType: 'video', category: 'video' },
  '.webm': { mimeType: 'video/webm', defaultSourceType: 'video', category: 'video' },
  '.mkv': { mimeType: 'video/x-matroska', defaultSourceType: 'video', category: 'video' },
  '.m4v': { mimeType: 'video/x-m4v', defaultSourceType: 'video', category: 'video' },
  '.pdf': { mimeType: 'application/pdf', defaultSourceType: 'poster', category: 'document' },
  '.html': { mimeType: 'text/html', defaultSourceType: 'website', category: 'document' },
  '.htm': { mimeType: 'text/html', defaultSourceType: 'website', category: 'document' },
};

export function getSupportedExtensions(): string[] {
  return Object.keys(SUPPORTED_EXTENSIONS);
}

export function getExtensionSpec(filePath: string): {
  extension: string;
  spec: SupportedExtensionSpec;
} {
  const extension = path.extname(filePath).toLowerCase();
  const spec = SUPPORTED_EXTENSIONS[extension];
  if (!spec) {
    throw new ValidationError(
      `Unsupported media file extension "${extension || '(none)'}". Supported extensions: ${getSupportedExtensions().join(', ')}.`,
      { filePath, extension },
    );
  }
  return { extension, spec };
}

export function inferSourceTypeFromUrl(urlString: string): SourceType {
  try {
    const parsed = new URL(urlString);
    const ext = path.extname(parsed.pathname).toLowerCase();
    const spec = SUPPORTED_EXTENSIONS[ext];
    if (spec) {
      return spec.defaultSourceType;
    }
    return 'website';
  } catch {
    return 'other';
  }
}

function parsePngDimensions(buf: Buffer): { width: number; height: number } | undefined {
  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 24 || !buf.subarray(0, 8).equals(pngSig)) {
    return undefined;
  }
  const ihdr = buf.subarray(12, 16).toString('ascii');
  if (ihdr !== 'IHDR') {
    return undefined;
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (width > 0 && height > 0) {
    return { width, height };
  }
  return undefined;
}

function parseGifDimensions(buf: Buffer): { width: number; height: number } | undefined {
  if (buf.length < 10) {
    return undefined;
  }
  const header = buf.subarray(0, 6).toString('ascii');
  if (header !== 'GIF87a' && header !== 'GIF89a') {
    return undefined;
  }
  const width = buf.readUInt16LE(6);
  const height = buf.readUInt16LE(8);
  if (width > 0 && height > 0) {
    return { width, height };
  }
  return undefined;
}

function parseJpegDimensions(buf: Buffer): { width: number; height: number } | undefined {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    return undefined;
  }
  let offset = 2;
  while (offset + 4 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buf[offset + 1];
    if (marker === undefined) {
      break;
    }
    if (
      marker === 0xd8 ||
      marker === 0xd9 ||
      marker === 0x00 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      offset += 2;
      continue;
    }
    if (offset + 3 >= buf.length) {
      break;
    }
    const segmentLength = buf.readUInt16BE(offset + 2);
    if (segmentLength < 2) {
      break;
    }
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isSof && offset + 9 <= buf.length) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      if (width > 0 && height > 0) {
        return { width, height };
      }
      return undefined;
    }
    offset += 2 + segmentLength;
  }
  return undefined;
}

function parseWebpDimensions(buf: Buffer): { width: number; height: number } | undefined {
  if (buf.length < 30) {
    return undefined;
  }
  if (
    buf.subarray(0, 4).toString('ascii') !== 'RIFF' ||
    buf.subarray(8, 12).toString('ascii') !== 'WEBP'
  ) {
    return undefined;
  }
  const chunk = buf.subarray(12, 16).toString('ascii');
  if (chunk === 'VP8X' && buf.length >= 30) {
    const width = 1 + buf.readUIntLE(24, 3);
    const height = 1 + buf.readUIntLE(27, 3);
    return { width, height };
  }
  if (chunk === 'VP8 ' && buf.length >= 30) {
    const width = buf.readUInt16LE(26) & 0x3fff;
    const height = buf.readUInt16LE(28) & 0x3fff;
    if (width > 0 && height > 0) {
      return { width, height };
    }
  }
  if (chunk === 'VP8L' && buf.length >= 25) {
    const bits = buf.readUInt32LE(21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height };
  }
  return undefined;
}

function parseSvgDimensions(buf: Buffer): { width: number; height: number } | undefined {
  const snippet = buf.subarray(0, 4096).toString('utf8');
  const widthMatch = /\bwidth\s*=\s*["'](\d+(?:\.\d+)?)(?:px)?["']/i.exec(snippet);
  const heightMatch = /\bheight\s*=\s*["'](\d+(?:\.\d+)?)(?:px)?["']/i.exec(snippet);
  if (widthMatch?.[1] && heightMatch?.[1]) {
    const width = Math.round(Number(widthMatch[1]));
    const height = Math.round(Number(heightMatch[1]));
    if (width > 0 && height > 0) {
      return { width, height };
    }
  }
  const viewBoxMatch =
    /\bviewBox\s*=\s*["'][\d.-]+\s+[\d.-]+\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)["']/i.exec(snippet);
  if (viewBoxMatch?.[1] && viewBoxMatch[2]) {
    const width = Math.round(Number(viewBoxMatch[1]));
    const height = Math.round(Number(viewBoxMatch[2]));
    if (width > 0 && height > 0) {
      return { width, height };
    }
  }
  return undefined;
}

export async function inspectLocalMediaFile(filePath: string): Promise<{
  metadata: TechnicalMetadata;
  defaultSourceType: SourceType;
}> {
  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch (error) {
    throw new ValidationError(
      `File does not exist or cannot be accessed: "${filePath}".`,
      { filePath },
      error,
    );
  }

  if (!stat.isFile()) {
    throw new ValidationError(`Path is not a regular file: "${filePath}".`, { filePath });
  }

  if (stat.size === 0) {
    throw new ValidationError(`File is empty (0 bytes): "${filePath}".`, { filePath });
  }

  const { extension, spec } = getExtensionSpec(filePath);

  const handle = await fs.open(filePath, 'r');
  let header: Buffer;
  try {
    const readLength = Math.min(stat.size, 65536);
    header = Buffer.alloc(readLength);
    await handle.read(header, 0, readLength, 0);
  } finally {
    await handle.close();
  }

  let dimensions: { width: number; height: number } | undefined;
  if (extension === '.png') {
    dimensions = parsePngDimensions(header);
  } else if (extension === '.gif') {
    dimensions = parseGifDimensions(header);
  } else if (extension === '.jpg' || extension === '.jpeg') {
    dimensions = parseJpegDimensions(header);
  } else if (extension === '.webp') {
    dimensions = parseWebpDimensions(header);
  } else if (extension === '.svg') {
    dimensions = parseSvgDimensions(header);
  }

  const metadata: TechnicalMetadata = {
    fileSizeBytes: stat.size,
    mimeType: spec.mimeType,
    extension,
    ...(dimensions ? { width: dimensions.width, height: dimensions.height } : {}),
  };

  return {
    metadata,
    defaultSourceType: spec.defaultSourceType,
  };
}
