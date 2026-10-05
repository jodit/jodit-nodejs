import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { jest } from '@jest/globals';
import {
  startTestServer,
  stopTestServer,
  TestServer
} from '../../tests/test-server';

const testFilesPath = path.join(process.cwd(), './files/test');

/**
 * A server that answers with far more data than the connector is allowed to
 * store, and never stops of its own accord.
 */
function startFirehose(): Promise<{
  url: (name: string) => string;
  sent: () => number;
  close: () => Promise<void>;
}> {
  let sent = 0;
  let stop = false;

  const server = http.createServer((req, res) => {
    if (req.url?.startsWith('/slow') === true) {
      // Accepts the request and then simply never answers.
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/octet-stream' });

    const chunk = Buffer.alloc(64 * 1024, 0x41);

    const push = (): void => {
      if (stop || res.writableEnded) {
        return;
      }

      sent += chunk.byteLength;

      if (res.write(chunk)) {
        setImmediate(push);
      } else {
        res.once('drain', push);
      }
    };

    res.on('close', () => {
      stop = true;
    });

    push();
  });

  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;

      resolve({
        url: name => `http://127.0.0.1:${port}/${name}`,
        sent: () => sent,
        close: () =>
          new Promise<void>(done => {
            stop = true;
            server.closeAllConnections();
            server.close(() => done());
          })
      });
    });
  });
}

describe('fileUploadRemote stops oversized and silent downloads', () => {
  let testServer: TestServer | null = null;
  let firehose: Awaited<ReturnType<typeof startFirehose>> | null = null;

  beforeAll(async () => {
    firehose = await startFirehose();
    testServer = await startTestServer({
      maxUploadFileSize: '256KB',
      timeoutLimit: 2
    });
  });

  afterAll(async () => {
    await stopTestServer(testServer!);
    await firehose?.close();
  });

  jest.setTimeout(30000);

  it('should refuse a body larger than maxUploadFileSize without reading it all', async () => {
    const response = await request(testServer!.host).post('/').send({
      action: 'fileUploadRemote',
      source: 'test',
      url: firehose!.url('huge.bin')
    });

    expect(response.status).toBe(403);
    expect(response.body.data.messages).toContain(
      'File size exceeds the allowable'
    );

    // The download is cut off near the limit instead of running to completion.
    expect(firehose!.sent()).toBeLessThan(32 * 1024 * 1024);

    await expect(
      fs.stat(path.join(testFilesPath, 'huge.bin'))
    ).rejects.toThrow();
  });

  it('should give up on a server that never answers', async () => {
    const started = Date.now();

    const response = await request(testServer!.host).post('/').send({
      action: 'fileUploadRemote',
      source: 'test',
      url: firehose!.url('slow')
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(Date.now() - started).toBeLessThan(15000);
  });
});
