import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { requestPinnedAddress } from './pinned-request';

interface Seen {
  host: string | undefined;
  path: string | undefined;
}

describe('requestPinnedAddress', () => {
  let server: http.Server | null = null;
  let port = 0;
  let seen: Seen = { host: undefined, path: undefined };

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      seen = { host: req.headers.host, path: req.url };
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('answered');
    });

    await new Promise<void>(resolve => {
      server!.listen(0, '127.0.0.1', resolve);
    });

    port = (server!.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>(resolve => {
      server!.closeAllConnections();
      server!.close(() => resolve());
    });
  });

  // The point of pinning: the name is never resolved again at connect time, so
  // a DNS answer that changes between the check and the request cannot move
  // the connection. Here `example.invalid` does not resolve at all, and the
  // request still lands on the pinned address.
  it('should connect to the pinned address instead of resolving the host', async () => {
    const url = new URL(`http://example.invalid:${port}/wanted`);

    const response = await requestPinnedAddress(url, '127.0.0.1', 5000);

    expect(response.status).toBe(200);
    expect(seen.path).toBe('/wanted');

    response.stream.resume();
  });

  it('should keep the original Host header so virtual hosts still work', async () => {
    const url = new URL(`http://example.invalid:${port}/vhost`);

    const response = await requestPinnedAddress(url, '127.0.0.1', 5000);
    response.stream.resume();

    expect(seen.host).toBe(`example.invalid:${port}`);
  });

  it('should carry the query string', async () => {
    const url = new URL(`http://example.invalid:${port}/search?q=1&b=2`);

    const response = await requestPinnedAddress(url, '127.0.0.1', 5000);
    response.stream.resume();

    expect(seen.path).toBe('/search?q=1&b=2');
  });

  it('should fail when the pinned address refuses the connection', async () => {
    const url = new URL('http://example.invalid:1/nothing');

    await expect(requestPinnedAddress(url, '127.0.0.1', 5000)).rejects.toThrow();
  });
});
