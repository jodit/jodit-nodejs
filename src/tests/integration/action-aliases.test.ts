import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import {
  startTestServer,
  stopTestServer,
  cleanupTestFiles,
  createTestFile,
  TestServer
} from '../test-server';

describe('Action route aliases', () => {
  let testServer: TestServer | null = null;
  const testFilesRoot = path.join(__dirname, '../../../files/test/tmp');

  beforeAll(async () => {
    testServer = await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer(testServer!);
  });

  beforeEach(async () => {
    await cleanupTestFiles();
    await fs.mkdir(testFilesRoot, { recursive: true });
    await createTestFile('existing.txt', 'hello world');
  });

  it('should return the same response for GET /files as for GET /?action=files', async () => {
    const queryResponse = await request(testServer!.host)
      .get('/')
      .query({ action: 'files', source: 'test' });

    expect(queryResponse.status).toBe(200);

    const pathResponse = await request(testServer!.host)
      .get('/files')
      .query({ source: 'test' });

    expect(pathResponse.status).toBe(queryResponse.status);
    expect(pathResponse.body).toEqual(queryResponse.body);

    expect(pathResponse.body.items).toBe(pathResponse.body.items);
  });

  it('should execute destructive actions when invoked via /:action', async () => {
    const uploadFileName = 'remove-me.txt';
    const uploadFilePath = path.join(testFilesRoot, uploadFileName);
    await fs.writeFile(uploadFilePath, 'upload content');

    const uploadResponse = await request(testServer!.host)
      .post('/fileUpload')
      .field('source', 'test')
      .attach('files', uploadFilePath);

    expect(uploadResponse.status).toBe(200);

    const response = await request(testServer!.host)
      .get(`/fileRemove`)
      .query({ source: 'test', name: uploadFileName });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true });
  });

  it('should process multipart uploads via POST /fileUpload without action field', async () => {
    const uploadFileName = 'path-alias-upload.txt';
    const uploadFilePath = path.join(testFilesRoot, uploadFileName);
    await fs.writeFile(uploadFilePath, 'upload content');

    try {
      const response = await request(testServer!.host)
        .post('/fileUpload')
        .field('source', 'test')
        .attach('files', uploadFilePath);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          files: expect.arrayContaining([uploadFileName])
        }
      });
    } finally {
      await fs.unlink(uploadFilePath).catch(() => undefined);
    }
  });
});
