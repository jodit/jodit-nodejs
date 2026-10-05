import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import {
  startTestServer,
  stopTestServer,
  createTestDirectories,
  TestServer
} from '../test-server';

const testFilesPath = path.join(process.cwd(), './files/test');

describe('folderRemove refuses to delete the folder being browsed', () => {
  let testServer: TestServer | null = null;

  beforeAll(async () => {
    testServer = await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer(testServer!);
  });

  beforeEach(async () => {
    await fs.mkdir(path.join(testFilesPath, 'keepme', 'inner'), {
      recursive: true
    });
    await fs.writeFile(path.join(testFilesPath, 'keepme', 'file.txt'), 'data');
  });

  afterEach(async () => {
    await fs.rm(path.join(testFilesPath, 'keepme'), {
      recursive: true,
      force: true
    });
  });

  it.each([
    ['.', 'the current folder by name'],
    ['inner/..', 'the current folder through a child']
  ])('should refuse name=%s (%s)', async name => {
    const response = await request(testServer!.host)
      .post('/')
      .send({ action: 'folderRemove', source: 'test', path: '/keepme', name });

    expect(response.status).toBe(404);
    await expect(
      fs.stat(path.join(testFilesPath, 'keepme', 'file.txt'))
    ).resolves.toBeDefined();
  });

  it('should refuse to wipe the source root', async () => {
    const response = await request(testServer!.host)
      .post('/')
      .send({ action: 'folderRemove', source: 'test', path: '/', name: '.' });

    expect(response.status).toBe(404);
    await expect(fs.stat(testFilesPath)).resolves.toBeDefined();
  });

  it('should still remove a real child folder', async () => {
    const response = await request(testServer!.host).post('/').send({
      action: 'folderRemove',
      source: 'test',
      path: '/keepme',
      name: 'inner'
    });

    expect(response.status).toBe(200);
    await expect(
      fs.stat(path.join(testFilesPath, 'keepme', 'inner'))
    ).rejects.toThrow();
  });
});

describe('writes do not escape the root through a symlinked folder', () => {
  let testServer: TestServer | null = null;
  let outside = '';
  const linkPath = path.join(testFilesPath, 'link');

  beforeAll(async () => {
    await createTestDirectories();
    outside = await fs.mkdtemp(path.join(os.tmpdir(), 'jodit-outside-'));
    await fs.symlink(outside, linkPath, 'dir');
    testServer = await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer(testServer!);
    await fs.unlink(linkPath).catch(() => undefined);
    await fs.rm(outside, { recursive: true, force: true });
  });

  it('should refuse to create a folder behind the link', async () => {
    const response = await request(testServer!.host).post('/').send({
      action: 'folderCreate',
      source: 'test',
      path: '/link',
      name: 'escaped'
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    await expect(fs.stat(path.join(outside, 'escaped'))).rejects.toThrow();
  });

  it('should refuse to upload behind the link', async () => {
    const source = path.join(testFilesPath, 'src-escape.txt');
    await fs.writeFile(source, 'payload');

    const response = await request(testServer!.host)
      .post('/')
      .field('action', 'fileUpload')
      .field('source', 'test')
      .field('path', '/link')
      .attach('files', source, 'escaped.txt');

    expect(response.status).toBeGreaterThanOrEqual(400);
    await expect(fs.stat(path.join(outside, 'escaped.txt'))).rejects.toThrow();

    await fs.unlink(source);
  });
});
