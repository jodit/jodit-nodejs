import request from 'supertest';
import {
  startTestServer,
  stopTestServer,
  cleanupTestFiles,
  createTestFile,
  TestServer,
  createTestDirectories
} from '../../tests/test-server';
import fs from 'fs/promises';
import path from 'path';

describe('Folder Copy (GET /?action=folderCopy)', () => {
  let testServer: TestServer | null = null;
  const testFilesPath = path.join(process.cwd(), './files/test');

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

  it('should copy folder recursively and keep the original', async () => {
    await createTestFile('inner.txt', 'inner content', '/testfolder');
    await createTestFile('deep.txt', 'deep content', '/testfolder/nested');

    const response = await request(testServer!.host).get('/').query({
      action: 'folderCopy',
      source: 'test',
      from: '/testfolder',
      path: '/subdir'
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // The original stays
    await expect(
      fs.access(path.join(testFilesPath, 'testfolder', 'inner.txt'))
    ).resolves.toBeUndefined();

    // The copy contains the whole tree
    const copiedInner = path.join(
      testFilesPath,
      'subdir',
      'testfolder',
      'inner.txt'
    );
    const copiedDeep = path.join(
      testFilesPath,
      'subdir',
      'testfolder',
      'nested',
      'deep.txt'
    );

    await expect(fs.access(copiedInner)).resolves.toBeUndefined();
    await expect(fs.access(copiedDeep)).resolves.toBeUndefined();

    expect(await fs.readFile(copiedDeep, 'utf8')).toBe('deep content');
  });

  it('should reject copying a folder into itself', async () => {
    await createTestFile('inner.txt', 'inner content', '/testfolder');

    const response = await request(testServer!.host).get('/').query({
      action: 'folderCopy',
      source: 'test',
      from: '/testfolder',
      path: '/testfolder'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 404 when source folder does not exist', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'folderCopy',
      source: 'test',
      from: '/non-existent-folder',
      path: '/subdir'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });
});
