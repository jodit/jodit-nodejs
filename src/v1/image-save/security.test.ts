import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import sharp from 'sharp';
import {
  startTestServer,
  stopTestServer,
  createTestDirectories,
  cleanupTestFiles,
  TestServer
} from '../../tests/test-server';

const testFilesPath = path.join(process.cwd(), './files/test');

async function pngBuffer(): Promise<Buffer> {
  return sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } }
  })
    .png()
    .toBuffer();
}

async function stored(name: string): Promise<string | null> {
  return fs.readFile(path.join(testFilesPath, name), 'utf8').catch(() => null);
}

describe('imageSave respects the extension whitelist', () => {
  let testServer: TestServer | null = null;

  beforeAll(async () => {
    testServer = await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer(testServer!);
  });

  beforeEach(async () => {
    await createTestDirectories();
  });

  afterEach(async () => {
    await cleanupTestFiles();
  });

  // The bytes are a real image, which is all imageSave used to check. The name
  // decides what the file host does with them, and a payload appended to a
  // valid image rides along untouched.
  it.each([
    ['shell.php', 'a file host running PHP would execute this'],
    ['evil.html', 'a file host would serve this as active content'],
    ['evil.js', 'a file host would serve this as a script']
  ])('should refuse to save as %s (%s)', async name => {
    const image = Buffer.concat([
      await pngBuffer(),
      Buffer.from('<?php system($_GET["c"]); ?><script>alert(1)</script>')
    ]);

    const response = await request(testServer!.host)
      .post('/')
      .field('action', 'imageSave')
      .field('source', 'test')
      .field('newname', name)
      .attach('files[0]', image, {
        filename: 'edited.png',
        contentType: 'image/png'
      });

    expect(response.status).toBe(403);
    expect(response.body.data.messages).toContain(
      'File type is not in white list'
    );
    await expect(stored(name)).resolves.toBeNull();
  });

  it('should still save under an allowed extension', async () => {
    const response = await request(testServer!.host)
      .post('/')
      .field('action', 'imageSave')
      .field('source', 'test')
      .field('newname', 'fine.png')
      .attach('files[0]', await pngBuffer(), {
        filename: 'edited.png',
        contentType: 'image/png'
      });

    expect(response.status).toBe(200);
    await expect(
      fs.stat(path.join(testFilesPath, 'fine.png'))
    ).resolves.toBeDefined();
  });

  it('should strip scripting when saving an SVG', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" onload="alert(document.domain)"><circle r="3"/></svg>'
    );

    const response = await request(testServer!.host)
      .post('/')
      .field('action', 'imageSave')
      .field('source', 'test')
      .field('newname', 'drawing.svg')
      .attach('files[0]', svg, {
        filename: 'drawing.svg',
        contentType: 'image/svg+xml'
      });

    expect(response.status).toBe(200);

    const saved = await stored('drawing.svg');
    expect(saved).not.toMatch(/onload|alert/i);
    expect(saved).toMatch(/<circle/);
  });
});
