import 'server-only';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

/**
 * SSRF protection for revalidation targets.
 *
 * Model: ALLOWLIST. Because this tool legitimately revalidates internal/VPN-only
 * sites (which live on private IP ranges), we do NOT blanket-block private ranges.
 * Instead:
 *   - Cloud-metadata, loopback, link-local and unspecified addresses are ALWAYS
 *     rejected (never a valid revalidate target, highest SSRF impact).
 *   - Private/reserved ranges are rejected UNLESS the host is explicitly permitted
 *     via REVALIDATE_ALLOWED_HOSTS (host, domain suffix, or CIDR).
 *   - Public hosts are allowed.
 *
 * DNS is resolved at call time and every resolved IP is checked, defeating
 * DNS-rebinding where a name resolves to a public IP once and an internal IP later.
 */

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

/**
 * Minimal validation for targets that are revalidated CLIENT-SIDE (preview/internal
 * channel). The server never calls these and may not even resolve internal DNS, so
 * the full SSRF allowlist does not apply — we only assert the URL is a well-formed
 * http(s) URL. The browser (on the VPN) performs the actual request.
 */
export function assertValidHttpUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError('Invalid URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new UnsafeUrlError(`Unsupported protocol: ${url.protocol}`);
  }
  return url;
}

function ipv4ToLong(ip: string): number {
  return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
}

function ipv4InCidr(ip: string, cidr: string): boolean {
  const [range, bitsRaw] = cidr.split('/');
  if (isIP(range) !== 4) return false;
  const bits = bitsRaw === undefined ? 32 : parseInt(bitsRaw, 10);
  if (!Number.isFinite(bits) || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4ToLong(ip) & mask) === (ipv4ToLong(range) & mask);
}

// Ranges that must ALWAYS be blocked, regardless of the allowlist.
const ALWAYS_BLOCK_V4 = [
  '0.0.0.0/8', // unspecified / "this" network
  '127.0.0.0/8', // loopback
  '169.254.0.0/16', // link-local (includes cloud metadata 169.254.169.254)
];

function isAlwaysBlocked(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) {
    return ALWAYS_BLOCK_V4.some((cidr) => ipv4InCidr(ip, cidr));
  }
  if (kind === 6) {
    const lower = ip.toLowerCase();
    return (
      lower === '::1' || // loopback
      lower === '::' || // unspecified
      lower.startsWith('fe80:') || // link-local
      lower.startsWith('fe80::') ||
      lower.includes('fd00:ec2::254') // AWS IMDS IPv6
    );
  }
  return false;
}

// Private / reserved ranges: blocked UNLESS the host is on the allowlist.
const PRIVATE_V4 = [
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '100.64.0.0/10', // CGNAT
  '192.0.0.0/24',
  '198.18.0.0/15', // benchmarking
];

function isPrivate(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return PRIVATE_V4.some((cidr) => ipv4InCidr(ip, cidr));
  if (kind === 6) {
    const lower = ip.toLowerCase();
    return lower.startsWith('fc') || lower.startsWith('fd'); // unique-local fc00::/7
  }
  return false;
}

function parseAllowlist(): string[] {
  return (process.env.REVALIDATE_ALLOWED_HOSTS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function hostMatchesAllowlist(hostname: string, resolvedIps: string[], allowlist: string[]): boolean {
  const host = hostname.toLowerCase();
  return allowlist.some((entry) => {
    if (entry.includes('/')) {
      // CIDR entry — match against resolved IPs (IPv4 only).
      return resolvedIps.some((ip) => isIP(ip) === 4 && ipv4InCidr(ip, entry));
    }
    // Host or domain-suffix entry.
    return host === entry || host.endsWith(`.${entry}`);
  });
}

/**
 * Validate a revalidation target URL. Throws UnsafeUrlError if the URL is not a
 * permitted target. Returns the parsed URL on success.
 */
export async function assertSafeRevalidateUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError('Invalid URL');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new UnsafeUrlError(`Unsupported protocol: ${url.protocol}`);
  }

  const hostname = url.hostname;

  // Resolve all IPs for the host (or use the literal IP if the host is one).
  let resolvedIps: string[];
  if (isIP(hostname)) {
    resolvedIps = [hostname];
  } else {
    try {
      const records = await lookup(hostname, { all: true });
      resolvedIps = records.map((r) => r.address);
    } catch {
      throw new UnsafeUrlError(`Could not resolve host: ${hostname}`);
    }
  }

  if (resolvedIps.length === 0) {
    throw new UnsafeUrlError(`Host did not resolve: ${hostname}`);
  }

  // 1. Always-blocked addresses are rejected no matter what.
  for (const ip of resolvedIps) {
    if (isAlwaysBlocked(ip)) {
      throw new UnsafeUrlError(
        `Target resolves to a blocked address (${ip}) — metadata/loopback/link-local are never allowed`
      );
    }
  }

  // 2. Allowlisted hosts bypass the private-range check.
  const allowlist = parseAllowlist();
  if (hostMatchesAllowlist(hostname, resolvedIps, allowlist)) {
    return url;
  }

  // 3. Otherwise, private/reserved targets are rejected.
  for (const ip of resolvedIps) {
    if (isPrivate(ip)) {
      throw new UnsafeUrlError(
        `Target resolves to a private address (${ip}). Add its host/CIDR to REVALIDATE_ALLOWED_HOSTS to permit it.`
      );
    }
  }

  // 4. Public host — allowed.
  return url;
}
