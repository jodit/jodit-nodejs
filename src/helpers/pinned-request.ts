import http from 'node:http';
import https from 'node:https';
import type { IncomingMessage } from 'node:http';
import Boom from '@hapi/boom';

export interface PinnedResponse {
  status: number;
  headers: IncomingMessage['headers'];
  stream: IncomingMessage;
}

/**
 * Make a request that goes to one specific address.
 *
 * Checking a host name and then letting the HTTP client resolve it again is
 * two lookups, and a name whose DNS answers differently the second time (a
 * short TTL, a rebinding service) passes the check and then connects
 * somewhere else entirely. Connecting to the address that was checked removes
 * the second lookup, and with it the window between them.
 *
 * `Host` is still the original name, and so is the TLS server name, so virtual
 * hosts keep working and the certificate is still verified against the name
 * the caller asked for rather than against the address.
 */
export async function requestPinnedAddress(
  url: URL,
  address: string,
  timeoutMs?: number
): Promise<PinnedResponse> {
  const secure = url.protocol === 'https:';
  const transport = secure ? https : http;
  const port = url.port !== '' ? Number(url.port) : secure ? 443 : 80;

  return new Promise<PinnedResponse>((resolve, reject) => {
    const request = transport.request(
      {
        host: address,
        port,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: { Host: url.host },
        // Verify the certificate against the name, not the pinned address.
        ...(secure ? { servername: url.hostname } : {}),
        ...(timeoutMs === undefined ? {} : { timeout: timeoutMs })
      },
      response => {
        resolve({
          status: response.statusCode ?? 0,
          headers: response.headers,
          stream: response
        });
      }
    );

    if (timeoutMs !== undefined) {
      request.setTimeout(timeoutMs, () => {
        request.destroy(Boom.badRequest('Request timed out'));
      });
    }

    request.on('error', error => {
      reject(
        Boom.isBoom(error)
          ? error
          : Boom.badRequest(`File was not loaded: ${error.message}`)
      );
    });

    request.end();
  });
}
