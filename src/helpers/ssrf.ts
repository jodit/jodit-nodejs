import net from 'node:net';
import dns from 'node:dns/promises';
import Boom from '@hapi/boom';
import { requestPinnedAddress } from './pinned-request';
import type { PinnedResponse } from './pinned-request';

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

/**
 * Expand an IPv6 address into its eight 16-bit groups.
 *
 * Needed because the same address has many spellings: `new URL()` rewrites
 * `::ffff:10.0.0.1` into `::ffff:a00:1`, so matching on the text catches one
 * form and misses the other. Returns `null` when the address does not parse.
 */
function expandV6(ip: string): number[] | null {
  const lower = ip.toLowerCase();
  const [head, tail, ...rest] = lower.split('::');

  if (rest.length > 0 || head === undefined) {
    return null;
  }

  const parse = (part: string): string[] =>
    part.length === 0 ? [] : part.split(':');

  const headParts = parse(head);
  const tailParts = tail === undefined ? [] : parse(tail);
  const parts = [...headParts, ...tailParts];

  // A trailing dotted quad (`::ffff:10.0.0.1`) stands for the last two groups.
  const last = parts[parts.length - 1];

  if (last?.includes('.') === true) {
    if (net.isIPv4(last) === false) {
      return null;
    }

    const octets = last.split('.').map(Number);
    const replacement = [
      ((octets[0] as number) << 8) | (octets[1] as number),
      ((octets[2] as number) << 8) | (octets[3] as number)
    ];

    if (tail === undefined) {
      headParts.splice(-1, 1);
    } else {
      tailParts.splice(-1, 1);
    }

    const groups = [...headParts, ...tailParts].map(part =>
      Number.parseInt(part, 16)
    );

    const missing = 8 - groups.length - replacement.length;

    if (tail === undefined) {
      return missing === 0 ? [...groups, ...replacement] : null;
    }

    if (missing < 0) {
      return null;
    }

    const headLength = headParts.length;

    return [
      ...groups.slice(0, headLength),
      ...new Array<number>(missing).fill(0),
      ...groups.slice(headLength),
      ...replacement
    ];
  }

  const groups = parts.map(part => Number.parseInt(part, 16));

  if (groups.some(group => Number.isNaN(group) || group < 0 || group > 0xffff)) {
    return null;
  }

  if (tail === undefined) {
    return groups.length === 8 ? groups : null;
  }

  const missing = 8 - groups.length;

  if (missing < 0) {
    return null;
  }

  return [
    ...groups.slice(0, headParts.length),
    ...new Array<number>(missing).fill(0),
    ...groups.slice(headParts.length)
  ];
}

/** Turn two 16-bit groups back into a dotted IPv4 string. */
function groupsToV4(high: number, low: number): string {
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
}

function isPrivateV6(ip: string): boolean {
  const groups = expandV6(ip);

  if (groups === null) {
    return true; // cannot be understood → treat as unsafe
  }

  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number
  ];

  const leadingZeros = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;

  // Unspecified (::) and loopback (::1).
  if (leadingZeros && g5 === 0 && g6 === 0 && (g7 === 0 || g7 === 1)) {
    return true;
  }

  // IPv4-mapped ::ffff:0:0/96 and the deprecated IPv4-compatible ::/96 — the
  // embedded IPv4 is what the packet actually goes to.
  if (leadingZeros && (g5 === 0xffff || g5 === 0)) {
    return isPrivateV4(groupsToV4(g6, g7));
  }

  // NAT64 well-known prefix 64:ff9b::/96 also carries an IPv4 destination.
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
    return isPrivateV4(groupsToV4(g6, g7));
  }

  // 6to4 2002::/16 embeds the IPv4 address in the next two groups.
  if (g0 === 0x2002) {
    return isPrivateV4(groupsToV4(g1, g2));
  }

  // Teredo 2001:0::/32 carries two IPv4 addresses: the relay server in groups
  // 2 and 3, and the client in the last two, stored inverted. Both decide
  // where the traffic actually ends up, so both are checked.
  if (g0 === 0x2001 && g1 === 0) {
    return (
      isPrivateV4(groupsToV4(g2, g3)) ||
      isPrivateV4(groupsToV4(~g6 & 0xffff, ~g7 & 0xffff))
    );
  }

  // fc00::/7 unique local, fe80::/10 link-local, ff00::/8 multicast.
  return (
    (g0 & 0xfe00) === 0xfc00 ||
    (g0 & 0xffc0) === 0xfe80 ||
    (g0 & 0xff00) === 0xff00
  );
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

/** Why a URL was rejected, and with which HTTP status it should be reported. */
export interface UrlRejection {
  status: 'badRequest' | 'forbidden';
  message: string;
}

/**
 * Check a user-supplied URL for SSRF, without throwing.
 *
 * Only `http`/`https` is allowed, and the host must not resolve to a loopback,
 * private, link-local (cloud metadata) or otherwise reserved address, so the
 * connector can't be turned into a proxy for internal services. Hostnames are
 * resolved so a name pointing at an internal IP is caught too.
 *
 * Returns `null` when the URL is safe to fetch, otherwise the reason. Use it
 * where a rejection is not an error for the whole request (for example when
 * filtering the resources of a rendered page); {@link assertPublicHttpUrl}
 * wraps it for the throwing case.
 */
export async function checkPublicHttpUrl(
  rawUrl: string
): Promise<UrlRejection | null> {
  const resolved = await resolveGuardedUrl(rawUrl);

  return 'status' in resolved ? resolved : null;
}

/**
 * Validate a URL and return the address it was validated against.
 *
 * The address matters to the caller: resolving the name again at connect time
 * is what lets a DNS rebinding answer send the request somewhere the check
 * never saw. See {@link requestPinnedAddress}.
 */
export async function resolveGuardedUrl(
  rawUrl: string
): Promise<UrlRejection | { url: URL; address: string }> {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return { status: 'badRequest', message: 'Invalid URL' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return {
      status: 'badRequest',
      message: 'Only http and https URLs are allowed'
    };
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');
  const lowerHost = host.toLowerCase();

  if (
    lowerHost === 'localhost' ||
    lowerHost.endsWith('.localhost') ||
    lowerHost.endsWith('.local')
  ) {
    return {
      status: 'forbidden',
      message: 'Requests to this host are not allowed'
    };
  }

  let addresses: string[];

  if (net.isIP(host)) {
    addresses = [host];
  } else {
    try {
      const records = await dns.lookup(host, { all: true });
      addresses = records.map(record => record.address);
    } catch {
      return { status: 'badRequest', message: 'Could not resolve URL host' };
    }
  }

  if (addresses.length === 0 || addresses[0] === undefined) {
    return { status: 'badRequest', message: 'Could not resolve URL host' };
  }

  for (const ip of addresses) {
    if (isPrivateIp(ip)) {
      return {
        status: 'forbidden',
        message: 'Requests to private or local addresses are not allowed'
      };
    }
  }

  return { url, address: addresses[0] };
}

/**
 * Guard against SSRF for user-supplied download URLs.
 *
 * Throwing wrapper around {@link checkPublicHttpUrl}.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<void> {
  const rejection = await checkPublicHttpUrl(rawUrl);

  if (rejection === null) {
    return;
  }

  throw rejection.status === 'forbidden'
    ? Boom.forbidden(rejection.message)
    : Boom.badRequest(rejection.message);
}

/** Resolve a host without judging it, for the trusted-setup path. */
async function resolveAnyAddress(url: URL): Promise<string> {
  const host = url.hostname.replace(/^\[|\]$/g, '');

  if (net.isIP(host)) {
    return host;
  }

  try {
    const record = await dns.lookup(host);
    return record.address;
  } catch {
    throw Boom.badRequest('Could not resolve URL host');
  }
}

/**
 * Download a URL without letting redirects, or DNS, escape the guard.
 *
 * Every hop is validated and then requested at the very address that was
 * validated, so a public URL that redirects to `http://169.254.169.254/…`, and
 * a name that answers publicly once and internally the next time, are both
 * stopped. When `validate` is false the guard is skipped (trusted internal
 * setup) but redirects are still followed by hand.
 */
export async function fetchGuardedAgainstSsrf(
  rawUrl: string,
  validate: boolean,
  maxRedirects = 5,
  timeoutMs?: number
): Promise<PinnedResponse> {
  let currentUrl = rawUrl;

  for (let hop = 0; ; hop++) {
    let url: URL;
    let address: string;

    if (validate) {
      const resolved = await resolveGuardedUrl(currentUrl);

      if ('status' in resolved) {
        throw resolved.status === 'forbidden'
          ? Boom.forbidden(resolved.message)
          : Boom.badRequest(resolved.message);
      }

      url = resolved.url;
      address = resolved.address;
    } else {
      try {
        url = new URL(currentUrl);
      } catch {
        throw Boom.badRequest('Invalid URL');
      }

      address = await resolveAnyAddress(url);
    }

    const response = await requestPinnedAddress(url, address, timeoutMs);

    const location = response.headers.location;
    const isRedirect =
      response.status >= 300 && response.status < 400 && location !== undefined;

    if (!isRedirect) {
      return response;
    }

    response.stream.resume();

    if (hop >= maxRedirects) {
      throw Boom.badRequest('Too many redirects');
    }

    currentUrl = new URL(location, currentUrl).toString();
  }
}

/**
 * Read a response body into memory, giving up as soon as it grows past the
 * limit.
 *
 * Reading the whole body first and checking the size afterwards means a URL
 * answering with a huge (or endless) body takes the server's memory down with
 * it. Going chunk by chunk enforces the limit while the download is still
 * happening.
 */
export async function readBodyWithLimit(
  response: PinnedResponse,
  maxBytes: number
): Promise<Buffer> {
  const declared = Number(response.headers['content-length']);

  if (Number.isFinite(declared) && declared > maxBytes) {
    response.stream.destroy();
    throw Boom.forbidden('File size exceeds the allowable');
  }

  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of response.stream) {
    const buffer = chunk as Buffer;
    total += buffer.byteLength;

    if (total > maxBytes) {
      response.stream.destroy();
      throw Boom.forbidden('File size exceeds the allowable');
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}
