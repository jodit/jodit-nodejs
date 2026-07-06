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

describe('File Copy (GET /?action=fileCopy)', () => {
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

  it('should copy file successfully and keep the original', async () => {
    const testFileName = 'test-copy.txt';
    await createTestFile(testFileName, 'content to copy');

    const response = await request(testServer!.host)
      .get('/')
      .query({
        action: 'fileCopy',
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

    // The original stays, the copy appears in the destination
    const originalPath = path.join(testFilesPath, testFileName);
    const copyPath = path.join(testFilesPath, 'subdir', testFileName);

    await expect(fs.access(originalPath)).resolves.toBeUndefined();
    await expect(fs.access(copyPath)).resolves.toBeUndefined();

    const copyContent = await fs.readFile(copyPath, 'utf8');
    expect(copyContent).toBe('content to copy');
  });

  it('should copy into the same folder with a " (N)" suffix', async () => {
    const testFileName = 'duplicate.txt';
    await createTestFile(testFileName, 'duplicate me');

    const doCopy = (): request.Test =>
      request(testServer!.host)
        .get('/')
        .query({
          action: 'fileCopy',
          source: 'test',
          from: `/${testFileName}`,
          path: '/'
        });

    const first = await doCopy();
    expect(first.status).toBe(200);

    const second = await doCopy();
    expect(second.status).toBe(200);

    const firstCopy = path.join(testFilesPath, 'duplicate (1).txt');
    const secondCopy = path.join(testFilesPath, 'duplicate (2).txt');

    await expect(fs.access(firstCopy)).resolves.toBeUndefined();
    await expect(fs.access(secondCopy)).resolves.toBeUndefined();
  });

  it('should return 404 when source file does not exist', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'fileCopy',
      source: 'test',
      from: '/non-existent-file.txt',
      path: '/subdir'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it('should return 400 when from parameter is missing', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'fileCopy',
      source: 'test',
      path: '/subdir'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});
