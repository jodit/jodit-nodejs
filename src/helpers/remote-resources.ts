import { checkPublicHttpUrl } from './ssrf';
import type { RemoteResourcesConfig } from '../types';

/**
 * Schemes that never leave the renderer, so they are always allowed: inline
 * images (`data:`), the blank starting document (`about:`) and blobs the page
 * created itself. Everything else must be `http`/`https`, which keeps `file:`
 * out of a page built from user-supplied HTML.
 */
const INLINE_PROTOCOLS = new Set(['data:', 'about:', 'blob:']);

const maskCache = new Map<string, RegExp>();

/**
 * Compile a URL mask into a regexp. `*` matches any run of characters, every
 * other character is literal, and the match is anchored and case-insensitive:
 * `https://cdn.example.com/*` or `*://*.example.com/*`.
 */
function maskToRegExp(mask: string): RegExp {
  const cached = maskCache.get(mask);

  if (cached !== undefined) {
    return cached;
  }

  const source = mask
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\*/g, '.*');

  const compiled = new RegExp(`^${source}$`, 'i');
  maskCache.set(mask, compiled);

  return compiled;
}

/** True when the URL matches at least one of the masks. */
export function matchesMask(url: string, masks: readonly string[]): boolean {
  return masks.some(mask => maskToRegExp(mask).test(url));
}

/**
 * Decide whether a document rendered from user-supplied HTML may load a
 * resource.
 *
 * The checks run in order: scheme, then the `deny` masks, then the `allow`
 * masks (when the list is not empty nothing outside it is loaded), and finally
 * the SSRF guard, which resolves the host and rejects loopback, private and
 * link-local addresses such as the cloud metadata service.
 *
 * @returns `null` when the resource may be loaded, otherwise the reason, meant
 * for the log.
 */
export async function checkRemoteResource(
  rawUrl: string,
  config: RemoteResourcesConfig = {}
): Promise<string | null> {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return 'invalid URL';
  }

  if (INLINE_PROTOCOLS.has(url.protocol)) {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return `scheme ${url.protocol} is not allowed`;
  }

  const deny = config.deny ?? [];

  if (deny.length > 0 && matchesMask(rawUrl, deny)) {
    return 'blocked by the deny list';
  }

  const allow = config.allow ?? [];

  if (allow.length > 0 && !matchesMask(rawUrl, allow)) {
    return 'not in the allow list';
  }

  if (config.allowPrivateNetwork === true) {
    return null;
  }

  const rejection = await checkPublicHttpUrl(rawUrl);

  return rejection === null ? null : rejection.message;
}
