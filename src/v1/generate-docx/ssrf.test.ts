import http from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { jest } from '@jest/globals';
import {
  startTestServer,
  stopTestServer,
  TestServer
} from '../../tests/test-server';

/** A local HTTP server standing in for an internal service, counting its hits. */
interface InternalService {
  url: string;
  hits: () => number;
  close: () => Promise<void>;
}

async function startInternalService(): Promise<InternalService> {
  let hits = 0;

  const server = http.createServer((_req, res) => {
    hits++;
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(Buffer.from('89504e470d0a1a0a', 'hex'));
  });

  await new Promise<void>(resolve => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}/secret.png`,
    hits: () => hits,
    close: () =>
      new Promise<void>(resolve => {
        server.closeAllConnections();
        server.close(() => resolve());
      })
  };
}

describe('Generate DOCX does not fetch internal resources', () => {
  let testServer: TestServer | null = null;
  let internal: InternalService | null = null;

  beforeAll(async () => {
    testServer = await startTestServer();
    internal = await startInternalService();
  });

  afterAll(async () => {
    await internal?.close();
    await stopTestServer(testServer!);
  }, 60000);

  jest.setTimeout(30000);

  it('should not download an image from a loopback service', async () => {
    const response = await request(testServer!.host)
      .post('/')
      .send({
        action: 'generateDocx',
        html: `<p>Report</p><img src="${internal!.url}" width="10" height="10"/>`
      });

    expect(response.status).toBe(200);
    expect(internal!.hits()).toBe(0);
  });

  it('should still convert the rest of the document', async () => {
    const response = await request(testServer!.host)
      .post('/')
      .buffer(true)
      .send({
        action: 'generateDocx',
        html: `<h1>Visible heading</h1><img src="${internal!.url}"/>`
      });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect(Number(response.headers['content-length'])).toBeGreaterThan(0);
    expect(internal!.hits()).toBe(0);
  });
});
