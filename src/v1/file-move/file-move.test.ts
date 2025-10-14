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

describe('File Move (GET /?action=fileMove)', () => {
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

  it('should move file successfully', async () => {
    // Create test file
    const testFileName = 'test-move.txt';
    await createTestFile(testFileName, 'content to move');

    const response = await request(testServer!.host)
      .get('/')
      .query({
        action: 'fileMove',
        source: 'test',
        from: `/${testFileName}`,
        path: '/subdir'
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        code: 220
      }
    });

    // Verify file was moved
    const oldPath = path.join(testFilesPath, testFileName);
    const newPath = path.join(testFilesPath, 'subdir', testFileName);

    const oldExists = await fs
      .access(oldPath)
      .then(() => true)
      .catch(() => false);
    const newExists = await fs
      .access(newPath)
      .then(() => true)
      .catch(() => false);

    expect(oldExists).toBe(false);
    expect(newExists).toBe(true);
  });

  it('should move folder successfully', async () => {
    // Create test folder with file
    await createTestFile('inner.txt', 'content', '/testfolder');

    const response = await request(testServer!.host).get('/').query({
      action: 'fileMove',
      source: 'test',
      from: '/testfolder',
      path: '/subdir'
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify folder was moved
    const oldPath = path.join(testFilesPath, 'testfolder');
    const newPath = path.join(testFilesPath, 'subdir', 'testfolder');

    const oldExists = await fs
      .access(oldPath)
      .then(() => true)
      .catch(() => false);
    const newExists = await fs
      .access(newPath)
      .then(() => true)
      .catch(() => false);

    expect(oldExists).toBe(false);
    expect(newExists).toBe(true);
  });

  it('should return 404 when source file does not exist', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'fileMove',
      source: 'test',
      from: '/non-existent-file.txt',
      path: '/subdir'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it('should return 400 when from parameter is missing', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'fileMove',
      source: 'test',
      path: '/subdir'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 404 when source does not exist', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'fileMove',
      source: 'non-existent-source',
      from: '/test.txt',
      path: '/subdir'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain('Source not found');
  });

  it('should reject path traversal attempts', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'fileMove',
      source: 'test',
      from: '/../../../etc/passwd',
      path: '/subdir'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it('should move file to root when path is not specified', async () => {
    // Create test file in subdirectory
    const testFileName = 'move-to-root.txt';
    await createTestFile(testFileName, 'content', '/subdir');

    const response = await request(testServer!.host)
      .get('/')
      .query({
        action: 'fileMove',
        source: 'test',
        from: `/subdir/${testFileName}`
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify file was moved to root
    const oldPath = path.join(testFilesPath, 'subdir', testFileName);
    const newPath = path.join(testFilesPath, testFileName);

    const oldExists = await fs
      .access(oldPath)
      .then(() => true)
      .catch(() => false);
    const newExists = await fs
      .access(newPath)
      .then(() => true)
      .catch(() => false);

    expect(oldExists).toBe(false);
    expect(newExists).toBe(true);
  });
});
