import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import {
  startTestServer,
  stopTestServer,
  TestServer
} from '../../tests/test-server';

const testFilesPath = path.join(process.cwd(), './files/test');

/** Write a file into the temp area tests upload from, return its path. */
async function fixture(name: string, content: string): Promise<string> {
  const target = path.join(testFilesPath, name);
  await fs.writeFile(target, content);
  return target;
}

async function readStored(name: string): Promise<string | null> {
  return fs.readFile(path.join(testFilesPath, name), 'utf8').catch(() => null);
}

describe('fileUpload keeps existing files when an upload is refused', () => {
  let testServer: TestServer | null = null;

  beforeAll(async () => {
    // "replace" is the setting that made a refused upload destructive: the
    // write landed on the existing name before anything was validated.
    testServer = await startTestServer({
      saveSameFileNameStrategy: 'replace',
      accessControl: [{ role: 'guest', extensions: 'pdf', FILE_UPLOAD: false }],
      defaultRole: 'guest'
    });
  });

  afterAll(async () => {
    await stopTestServer(testServer!);
  });

  it('should leave the original in place when the role may not upload that extension', async () => {
    await fs.writeFile(
      path.join(testFilesPath, 'contract.pdf'),
      'THE ORIGINAL CONTRACT'
    );

    const upload = await fixture('payload-contract.pdf', 'attacker content');

    const response = await request(testServer!.host)
      .post('/')
      .field('action', 'fileUpload')
      .field('source', 'test')
      .attach('files', upload, 'contract.pdf');

    expect(response.status).toBe(403);
    await expect(readStored('contract.pdf')).resolves.toBe(
      'THE ORIGINAL CONTRACT'
    );

    await fs.unlink(upload);
    await fs.unlink(path.join(testFilesPath, 'contract.pdf'));
  });

  it('should not write any file of a batch when a later one is refused', async () => {
    await fs.writeFile(path.join(testFilesPath, 'notes.txt'), 'ORIGINAL NOTES');

    const good = await fixture('batch-notes.txt', 'replacement notes');
    const bad = await fixture('batch-bad.pdf', 'refused');

    const response = await request(testServer!.host)
      .post('/')
      .field('action', 'fileUpload')
      .field('source', 'test')
      .attach('files', good, 'notes.txt')
      .attach('files', bad, 'blocked.pdf');

    expect(response.status).toBe(403);
    await expect(readStored('notes.txt')).resolves.toBe('ORIGINAL NOTES');
    await expect(readStored('blocked.pdf')).resolves.toBeNull();

    await fs.unlink(good);
    await fs.unlink(bad);
    await fs.unlink(path.join(testFilesPath, 'notes.txt'));
  });
});

describe('fileUpload default extension whitelist', () => {
  let testServer: TestServer | null = null;

  beforeAll(async () => {
    testServer = await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer(testServer!);
  });

  it.each([
    ['page.html', '<script>alert(document.domain)</script>'],
    ['page.htm', '<script>alert(document.domain)</script>'],
    ['script.js', 'alert(document.domain)']
  ])(
    'should refuse %s, which the file host would serve as active content',
    async (name, content) => {
      const upload = await fixture(`src-${name}`, content);

      const response = await request(testServer!.host)
        .post('/')
        .field('action', 'fileUpload')
        .field('source', 'test')
        .attach('files', upload, name);

      expect(response.status).toBe(403);
      await expect(readStored(name)).resolves.toBeNull();

      await fs.unlink(upload);
    }
  );

  it('should still accept an ordinary image', async () => {
    const upload = await fixture('src-ok-image.png', 'not really a png');

    const response = await request(testServer!.host)
      .post('/')
      .field('action', 'fileUpload')
      .field('source', 'test')
      .attach('files', upload, 'ok-image.png');

    expect(response.status).toBe(200);
    await fs.unlink(upload);
    await fs.unlink(path.join(testFilesPath, 'ok-image.png'));
  });
});

describe('fileUpload strips scripting from SVG', () => {
  let testServer: TestServer | null = null;

  beforeAll(async () => {
    testServer = await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer(testServer!);
  });

  it('should store an SVG without its onload handler', async () => {
    const upload = await fixture(
      'src-evil.svg',
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.domain)"><circle r="5"/></svg>'
    );

    const response = await request(testServer!.host)
      .post('/')
      .field('action', 'fileUpload')
      .field('source', 'test')
      .attach('files', upload, 'evil.svg');

    expect(response.status).toBe(200);

    const stored = await readStored('evil.svg');
    expect(stored).not.toMatch(/onload|alert/i);
    expect(stored).toMatch(/<circle/);

    await fs.unlink(upload);
    await fs.unlink(path.join(testFilesPath, 'evil.svg'));
  });
});
