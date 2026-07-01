import net from 'node:net';
import dns from 'node:dns/promises';
import Boom from '@hapi/boom';

/** IPv4 dotted-quad → unsigned 32-bit integer. */
function ipToLong(ip: string): number {
  return (
    ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0
  );
}

function inRange(ip: number, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ip & mask) === (ipToLong(base) & mask);
}

function isPrivateV4(ip: string): boolean {
  const n = ipToLong(ip);
  return (
    inRange(n, '0.0.0.0', 8) || // "this" network
    inRange(n, '10.0.0.0', 8) || // private
    inRange(n, '100.64.0.0', 10) || // CGNAT
    inRange(n, '127.0.0.0', 8) || // loopback
    inRange(n, '169.254.0.0', 16) || // link-local (incl. cloud metadata)
    inRange(n, '172.16.0.0', 12) || // private
    inRange(n, '192.0.0.0', 24) || // IETF protocol assignments
    inRange(n, '192.168.0.0', 16) || // private
    inRange(n, '198.18.0.0', 15) || // benchmarking
    inRange(n, '224.0.0.0', 4) || // multicast
    inRange(n, '240.0.0.0', 4) // reserved
  );
}

function isPrivateV6(ip: string): boolean {
  const lower = ip.toLowerCase();

  if (lower === '::1' || lower === '::') {
    return true;
  }

  // IPv4-mapped (::ffff:a.b.c.d) — validate the embedded IPv4.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) {
    return isPrivateV4(mapped[1]);
  }

  // fc00::/7 (unique local) and fe80::/10 (link-local).
  return /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower);
}

function isPrivateIp(ip: string): boolean {
  const version = net.isIP(ip);

  if (version === 4) {
    return isPrivateV4(ip);
  }

  if (version === 6) {
    return isPrivateV6(ip);
  }

  return true; // not a valid IP → treat as unsafe
}

/**
 * Guard against SSRF for user-supplied download URLs.
 *
 * Only `http`/`https` is allowed, and the host must not resolve to a loopback,
 * private, link-local (cloud metadata) or otherwise reserved address — so the
 * connector can't be turned into a proxy for internal services. Hostnames are
 * resolved so a name pointing at an internal IP is caught too.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<void> {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw Boom.badRequest('Invalid URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw Boom.badRequest('Only http and https URLs are allowed');
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');
  const lowerHost = host.toLowerCase();

  if (
    lowerHost === 'localhost' ||
    lowerHost.endsWith('.localhost') ||
    lowerHost.endsWith('.local')
  ) {
    throw Boom.forbidden('Requests to this host are not allowed');
  }

  let addresses: string[];

  if (net.isIP(host)) {
    addresses = [host];
  } else {
    try {
      const records = await dns.lookup(host, { all: true });
      addresses = records.map(record => record.address);
    } catch {
      throw Boom.badRequest('Could not resolve URL host');
    }
  }

  if (addresses.length === 0) {
    throw Boom.badRequest('Could not resolve URL host');
  }

  for (const ip of addresses) {
    if (isPrivateIp(ip)) {
      throw Boom.forbidden(
        'Requests to private or local addresses are not allowed'
      );
    }
  }
}
