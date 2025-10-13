import request from 'supertest';
import {
  startTestServer,
  stopTestServer,
  cleanupTestFiles,
  createTestFile,
  TestServer
} from '../../tests/test-server';

describe('Get Local File By URL (GET /?action=getLocalFileByUrl)', () => {
  let testServer: TestServer | null = null;

  beforeAll(async () => {
    testServer = await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer(testServer!);
  });

  beforeEach(async () => {
    await cleanupTestFiles();
  });

  afterEach(async () => {
    await cleanupTestFiles();
  });

  it('should resolve file URL successfully', async () => {
    // Create test file
    const testFileName = 'test-resolve.txt';
    await createTestFile(testFileName, 'test content');

    const response = await request(testServer!.host)
      .get('/')
      .query({
        action: 'getLocalFileByUrl',
        url: `http://localhost:8081/files/test/${testFileName}`
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        code: 220,
        path: '/',
        name: testFileName,
        source: 'test'
      }
    });
  });

  it('should resolve file in subdirectory', async () => {
    // Create test file in subdirectory
    const testFileName = 'nested-file.txt';
    await createTestFile(testFileName, 'nested content', '/subdir');

    const response = await request(testServer!.host).get('/').query({
      action: 'getLocalFileByUrl',
      url: 'http://localhost:8081/files/test/subdir/nested-file.txt'
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.path).toBe('/subdir');
    expect(response.body.data.name).toBe(testFileName);
    expect(response.body.data.source).toBe('test');
  });

  it('should return 400 when URL parameter is missing', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'getLocalFileByUrl'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 400 for invalid URL', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'getLocalFileByUrl',
      url: 'not-a-valid-url'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain('Empty url');
  });

  it('should return 400 when file does not exist', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'getLocalFileByUrl',
      url: 'http://localhost:8081/files/test/non-existent.txt'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages[0]).toContain('File does not exist');
  });

  it('should return 400 when URL does not match any source', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'getLocalFileByUrl',
      url: 'http://example.com/some/file.txt'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should handle URL with query parameters', async () => {
    // Create test file
    const testFileName = 'image.png';
    await createTestFile(testFileName, 'image data');

    const response = await request(testServer!.host).get('/').query({
      action: 'getLocalFileByUrl',
      url: 'http://localhost:8081/files/test/image.png?v=123'
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe(testFileName);
  });

  it('should reject path traversal in URL', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'getLocalFileByUrl',
      url: 'http://localhost:8081/files/test/../../../etc/passwd'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should not resolve directories', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'getLocalFileByUrl',
      url: 'http://localhost:8081/files/test/subdir'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});
