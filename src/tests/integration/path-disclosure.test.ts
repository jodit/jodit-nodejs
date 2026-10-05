import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { startTestServer, stopTestServer, TestServer } from '../test-server';
import { collectRoots, redactPaths } from '../../helpers/redact-paths';

const testFilesPath = path.join(process.cwd(), './files/test');

describe('redactPaths', () => {
  it('should remove a root from a storage error', () => {
    const message =
      "EINVAL: invalid argument, rename '/srv/www/files/a' -> '/srv/www/files/a/b/a'";

    expect(redactPaths(message, ['/srv/www/files'])).toBe(
      "EINVAL: invalid argument, rename '/a' -> '/a/b/a'"
    );
  });

  it('should strip a nested root before its parent', () => {
    const roots = collectRoots({
      root: '/srv/www',
      sources: { s: { name: 's', title: 's', root: '/srv/www/files' } }
    } as never);

    expect(redactPaths("open '/srv/www/files/x.png'", roots)).toBe(
      "open '/x.png'"
    );
  });

  it('should leave a message without paths alone', () => {
    expect(redactPaths('File type is not in white list', ['/srv/www'])).toBe(
      'File type is not in white list'
    );
  });
});

describe('responses do not disclose where files live', () => {
  let testServer: TestServer | null = null;

  beforeAll(async () => {
    testServer = await startTestServer();
    await fs.mkdir(path.join(testFilesPath, 'movable', 'inner'), {
      recursive: true
    });
  });

  afterAll(async () => {
    await stopTestServer(testServer!);
    await fs.rm(path.join(testFilesPath, 'movable'), {
      recursive: true,
      force: true
    });
  });

  it('should not put the server path into a failing folderMove', async () => {
    const response = await request(testServer!.host).post('/').send({
      action: 'folderMove',
      source: 'test',
      from: 'movable',
      path: 'movable/inner'
    });

    const body = JSON.stringify(response.body);

    expect(body).not.toContain(testFilesPath);
    expect(body).not.toContain(process.cwd());
  });

  it('should not return a thumb that climbs out of the listed folder', async () => {
    const broken = path.join(testFilesPath, 'broken.png');
    await fs.writeFile(broken, 'this is not a png');

    const response = await request(testServer!.host)
      .post('/')
      .send({ action: 'files', source: 'test', path: '/' });

    expect(response.status).toBe(200);

    const thumbs: string[] = (response.body.data.sources ?? [])
      .flatMap((source: { files?: { thumb?: string }[] }) => source.files ?? [])
      .map((file: { thumb?: string }) => file.thumb)
      .filter((thumb: string | undefined): thumb is string => Boolean(thumb));

    for (const thumb of thumbs) {
      expect(thumb).not.toMatch(/\.\./);
      expect(thumb).not.toContain(process.cwd());
    }

    await fs.unlink(broken);
  });
});
