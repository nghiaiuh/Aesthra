import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {
  ensureWorkspaceStructure,
  resolveWorkspacePaths,
  type WorkspacePaths,
} from '@aesthra/core';

export async function createTempWorkspace(): Promise<{
  root: string;
  paths: WorkspacePaths;
  cleanup: () => Promise<void>;
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aesthra-test-'));
  const paths = resolveWorkspacePaths(root);
  await ensureWorkspaceStructure(paths);
  return {
    root,
    paths,
    cleanup: async () => {
      await fs.rm(root, { recursive: true, force: true });
    },
  };
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i] ?? 0;
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

export function createMinimalPngBuffer(width = 320, height = 240): Buffer {
  const rowSize = 1 + width * 4;
  const raw = Buffer.alloc(rowSize * height, 0x20);
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const idat = zlib.deflateSync(raw);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
