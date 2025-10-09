import request from 'supertest';
import {
  startTestServer,
  stopTestServer,
  cleanupTestFiles,
  createTestFile,
  TestServer,
  createTestDirectories
} from '../../tests/test-server';

describe('File Download (GET /?action=fileDownload)', () => {
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

  it('should download file successfully', async () => {
    // Create test file
    const testFileName = 'test-download.txt';
    const testContent = 'content to download';
    await createTestFile(testFileName, testContent);

    const response = await request(testServer!.host).get('/').query({
      action: 'fileDownload',
      source: 'test',
      name: testFileName
    });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/octet-stream');
    expect(response.headers['content-disposition']).toContain(
      `attachment; filename="${testFileName}"`
    );
    expect(response.headers['content-transfer-encoding']).toBe('binary');
    expect(response.body.toString()).toBe(testContent);
  });

  it('should download binary file successfully', async () => {
    // Create test binary file
    const testFileName = 'test.bin';
    const testContent = Buffer.from([0x00, 0x01, 0x02, 0xff]);
    await createTestFile(testFileName, testContent.toString('binary'));

    const response = await request(testServer!.host).get('/').query({
      action: 'fileDownload',
      source: 'test',
      name: testFileName
    });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/octet-stream');
    expect(Buffer.from(response.body).length).toBeGreaterThan(0);
  });

  it('should return 404 when file does not exist', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'fileDownload',
      source: 'test',
      name: 'non-existent-file.txt'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages[0]).toContain(
      'File or directory not exists'
    );
  });

  it('should return 400 when name parameter is missing', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'fileDownload',
      source: 'test'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 404 when source does not exist', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'fileDownload',
      source: 'non-existent-source',
      name: 'test.txt'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain('Source not found');
  });

  it('should download file from subdirectory', async () => {
    // Create test file in subdirectory
    const testFileName = 'subdir-file.txt';
    const testContent = 'content in subdir';
    await createTestFile(testFileName, testContent, '/subdir');

    const response = await request(testServer!.host).get('/').query({
      action: 'fileDownload',
      source: 'test',
      path: '/subdir',
      name: testFileName
    });

    expect(response.status).toBe(200);
    expect(response.body.toString()).toBe(testContent);
  });

  it('should reject path traversal attempts', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'fileDownload',
      source: 'test',
      name: '../../../etc/passwd'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it('should return 400 when trying to download directory', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'fileDownload',
      source: 'test',
      name: 'subdir'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain('It is not a file!');
  });

  it('should set correct content-length header', async () => {
    const testFileName = 'sized-file.txt';
    const testContent = 'exact content';
    await createTestFile(testFileName, testContent);

    const response = await request(testServer!.host).get('/').query({
      action: 'fileDownload',
      source: 'test',
      name: testFileName
    });

    expect(response.status).toBe(200);
    expect(response.headers['content-length']).toBe(
      testContent.length.toString()
    );
  });
});
