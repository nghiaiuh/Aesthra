import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  type CreativeAnalysis,
  type CreativeReference,
  type ObservationItem,
  ValidationError,
  createStableId,
  nowIso,
  sha256File,
} from '@aesthra/core';
import { inspectLocalMediaFile } from '@aesthra/ingestion';
import { type AnalyzerCapability, type AnalyzerProvider } from './provider.js';

const execFileAsync = promisify(execFile);

interface FfprobeVideoInfo {
  durationSeconds?: number;
  width?: number;
  height?: number;
  codec?: string;
}

export async function probeFfprobeAvailability(): Promise<{
  available: boolean;
  binaryPath: string;
}> {
  const binaryPath = process.env['FFPROBE_PATH']?.trim() || 'ffprobe';
  try {
    await execFileAsync(binaryPath, ['-version'], { timeout: 3000 });
    return { available: true, binaryPath };
  } catch {
    return { available: false, binaryPath };
  }
}

async function inspectVideoWithFfprobe(filePath: string): Promise<FfprobeVideoInfo | undefined> {
  const probe = await probeFfprobeAvailability();
  if (!probe.available) {
    return undefined;
  }

  try {
    const { stdout } = await execFileAsync(
      probe.binaryPath,
      ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filePath],
      { timeout: 10000 },
    );

    const parsed = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: Array<{
        codec_type?: string;
        codec_name?: string;
        width?: number;
        height?: number;
      }>;
    };

    const videoStream = parsed.streams?.find((s) => s.codec_type === 'video');
    const durationNum = parsed.format?.duration ? Number(parsed.format.duration) : undefined;

    return {
      ...(durationNum !== undefined && Number.isFinite(durationNum)
        ? { durationSeconds: durationNum }
        : {}),
      ...(videoStream?.width ? { width: videoStream.width } : {}),
      ...(videoStream?.height ? { height: videoStream.height } : {}),
      ...(videoStream?.codec_name ? { codec: videoStream.codec_name } : {}),
    };
  } catch {
    return undefined;
  }
}

export class TechnicalMetadataAnalyzer implements AnalyzerProvider {
  public readonly id = 'technical-metadata-inspector';
  public readonly version = '0.1.0';

  getCapabilities(): Promise<AnalyzerCapability> {
    return Promise.resolve({
      id: this.id,
      supportsVisualImages: false,
      supportsVideo: false,
      supportsMetadataOnly: true,
      configured: true,
    });
  }

  async analyze(reference: CreativeReference, workspaceRoot: string): Promise<CreativeAnalysis> {
    const analyzedAt = nowIso();

    if (!reference.localPath) {
      return {
        id: createStableId('ana'),
        referenceId: reference.id,
        analyzer: this.id,
        analyzerVersion: this.version,
        analysisKind: 'technical_metadata',
        analyzedAt,
        observations: [],
        interpretations: [],
        confidence: 0,
        uncertainty: [
          'Reference is registered by URL only and has no local media file.',
          'Aesthra does not fabricate visual observations from URLs or scrape external websites automatically.',
          'Import a structured analysis with "aesthra analyze <id> --import <file.json>" after manual or agent-assisted inspection.',
        ],
        extractedPatterns: [],
        sourceEvidence: {
          mediaAccessible: false,
          inspectedSourceType: 'metadata_only',
          ...(reference.sourceUrl ? { sourcePathOrUrl: reference.sourceUrl } : {}),
          limitations: [
            'Remote media was not downloaded or visually inspected.',
            'No vision-capable AI provider is configured.',
          ],
        },
      };
    }

    const resolvedFile = path.isAbsolute(reference.localPath)
      ? reference.localPath
      : path.resolve(workspaceRoot, reference.localPath);

    try {
      await fs.access(resolvedFile);
    } catch (error) {
      throw new ValidationError(
        `Local media file for reference "${reference.id}" is missing or unreadable at "${resolvedFile}".`,
        { referenceId: reference.id, localPath: reference.localPath },
        error,
      );
    }

    const { metadata } = await inspectLocalMediaFile(resolvedFile);
    const currentHash = await sha256File(resolvedFile);

    let videoInfo: FfprobeVideoInfo | undefined;
    if (reference.sourceType === 'video') {
      videoInfo = await inspectVideoWithFfprobe(resolvedFile);
    }

    const observations: ObservationItem[] = [];
    if (metadata.mimeType) {
      observations.push({
        id: 'obs_tech_mime',
        dimension: 'technical',
        statement: `Verified file format ${metadata.mimeType} (${metadata.extension ?? 'unknown extension'}), size ${metadata.fileSizeBytes ?? 0} bytes.`,
        evidenceType: 'technical_metadata',
        evidenceRef: reference.localPath,
      });
    }

    const width = videoInfo?.width ?? metadata.width;
    const height = videoInfo?.height ?? metadata.height;
    if (width && height) {
      const orientation = width > height ? 'landscape' : height > width ? 'portrait' : 'square';
      observations.push({
        id: 'obs_tech_dimensions',
        dimension: 'technical',
        statement: `Verified pixel dimensions ${width}x${height} (${orientation} aspect).`,
        evidenceType: 'technical_metadata',
        evidenceRef: reference.localPath,
      });
    }

    if (videoInfo?.durationSeconds !== undefined || videoInfo?.codec) {
      observations.push({
        id: 'obs_tech_video',
        dimension: 'technical',
        statement: `Verified video stream via ffprobe: codec=${videoInfo.codec ?? 'unknown'}, duration=${videoInfo.durationSeconds?.toFixed(2) ?? 'unknown'}s.`,
        evidenceType: 'technical_metadata',
        evidenceRef: reference.localPath,
      });
    }

    const limitations = [
      'No vision-capable AI analyzer is configured; composition, lighting, color, typography, and motion semantics were not visually analyzed.',
    ];
    if (reference.sourceType === 'video' && !videoInfo) {
      limitations.push(
        'ffprobe is not installed or failed to inspect video stream metadata; duration and codec remain unverified.',
      );
    }
    if (reference.contentHash && currentHash !== reference.contentHash) {
      limitations.push(
        `File content hash changed since registration (registered ${reference.contentHash}, current ${currentHash}).`,
      );
    }

    return {
      id: createStableId('ana'),
      referenceId: reference.id,
      analyzer: this.id,
      analyzerVersion: this.version,
      analysisKind: 'technical_metadata',
      analyzedAt,
      observations,
      interpretations: [],
      confidence: observations.length > 0 ? 0.95 : 0.2,
      uncertainty: limitations,
      extractedPatterns: [],
      sourceEvidence: {
        mediaAccessible: true,
        inspectedSourceType: 'local_file',
        sourcePathOrUrl: reference.localPath,
        contentHash: currentHash,
        limitations,
      },
    };
  }
}
