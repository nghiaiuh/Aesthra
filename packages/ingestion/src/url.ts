import net from 'node:net';
import { ValidationError } from '@aesthra/core';

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
]);

function isPrivateOrLocalIp(host: string): boolean {
  const cleanHost = host.replace(/^\[|\]$/g, '');
  const ipVersion = net.isIP(cleanHost);
  if (ipVersion === 0) {
    return false;
  }

  if (ipVersion === 4) {
    const parts = cleanHost.split('.').map(Number);
    const [a = 0, b = 0] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  const lower = cleanHost.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('fe80')) return true;
  if (lower.startsWith('::ffff:')) {
    const mappedV4 = lower.slice('::ffff:'.length);
    return isPrivateOrLocalIp(mappedV4);
  }
  return false;
}

export function validateAndNormalizeUrl(rawUrl: string): {
  sourceUrl: string;
  canonicalUrl: string;
} {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch (error) {
    throw new ValidationError(`Invalid URL "${rawUrl}".`, { rawUrl }, error);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ValidationError(
      `Unsupported URL protocol "${parsed.protocol}". Only http: and https: URLs are permitted.`,
      { rawUrl, protocol: parsed.protocol },
    );
  }

  if (parsed.username || parsed.password) {
    throw new ValidationError('URLs containing embedded credentials are not permitted.', {
      rawUrl,
    });
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    isPrivateOrLocalIp(hostname)
  ) {
    throw new ValidationError(
      `Refusing local, loopback, or private-network URL "${hostname}" for SSRF safety.`,
      { rawUrl, hostname },
    );
  }

  const canonical = new URL(parsed.toString());
  canonical.hash = '';
  canonical.hostname = hostname;
  if (
    (canonical.protocol === 'http:' && canonical.port === '80') ||
    (canonical.protocol === 'https:' && canonical.port === '443')
  ) {
    canonical.port = '';
  }

  for (const key of [...canonical.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) {
      canonical.searchParams.delete(key);
    }
  }
  canonical.searchParams.sort();

  if (canonical.pathname.length > 1 && canonical.pathname.endsWith('/')) {
    canonical.pathname = canonical.pathname.slice(0, -1);
  }

  return {
    sourceUrl: parsed.toString(),
    canonicalUrl: canonical.toString(),
  };
}

