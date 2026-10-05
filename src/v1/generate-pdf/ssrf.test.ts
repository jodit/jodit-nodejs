import http from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { jest } from '@jest/globals';
import {
  startTestServer,
  stopTestServer,
  TestServer
} from '../../tests/test-server';
import { browserPool } from '../../helpers/browser-pool';

/**
 * A local HTTP server standing in for an internal service: it counts the hits
 * it gets, so a test can assert that the renderer never reached it.
 */
interface InternalService {
  url: string;
  hits: () => number;
  close: () => Promise<void>;
}

async function startInternalService(): Promise<InternalService> {
  let hits = 0;

  const server = http.createServer((_req, res) => {
    hits++;
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('INTERNAL-SECRET-MARKER');
  });

  await new Promise<void>(resolve => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}/secret`,
    hits: () => hits,
    close: () =>
      new Promise<void>(resolve => {
        // Drop keep-alive sockets, otherwise close() waits for them and the
        // afterAll hook runs into its timeout.
        server.closeAllConnections();
        server.close(() => resolve());
      })
  };
}

describe('Generate PDF does not fetch internal resources', () => {
  let testServer: TestServer | null = null;
  let internal: InternalService | null = null;

  beforeAll(async () => {
    testServer = await startTestServer();
    internal = await startInternalService();
  });

  afterAll(async () => {
    await internal?.close();
    await stopTestServer(testServer!);
    await browserPool.closeBrowser();
  }, 60000);

  jest.setTimeout(30000);

  it('should not load an iframe pointing at a loopback service', async () => {
    const response = await request(testServer!.host)
      .post('/')
      .send({
        action: 'generatePdf',
        html: `<iframe src="${internal!.url}" width="600" height="400"></iframe>`
      });

    expect(response.status).toBe(200);
    expect(internal!.hits()).toBe(0);
  });

  it('should not load an image pointing at a loopback service', async () => {
    const response = await request(testServer!.host)
      .post('/')
      .send({
        action: 'generatePdf',
        html: `<img src="${internal!.url}" width="100" height="100"/>`
      });

    expect(response.status).toBe(200);
    expect(internal!.hits()).toBe(0);
  });

  it('should still render the document itself', async () => {
    const response = await request(testServer!.host)
      .post('/')
      .send({
        action: 'generatePdf',
        html: `<h1>Visible</h1><iframe src="${internal!.url}"></iframe>`
      });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.body.length).toBeGreaterThan(0);
    expect(internal!.hits()).toBe(0);
  });
});
