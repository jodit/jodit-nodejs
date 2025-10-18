import request from 'supertest';
import {
  startTestServer,
  stopTestServer,
  cleanupTestFiles,
  createTestFile,
  TestServer,
  createTestDirectories
} from '../../tests/test-server';

describe('File Remove (GET /?action=fileRemove)', () => {
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

  it('should remove file successfully', async () => {
    // Create test file
    const testFileName = 'test-remove.txt';
    await createTestFile(testFileName, 'content to remove');

    const response = await request(testServer!.host).get('/').query({
      action: 'fileRemove',
      source: 'test',
      name: testFileName
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        code: 220
      }
    });
  });

  it('should return 404 when file does not exist', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'fileRemove',
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
      action: 'fileRemove',
      source: 'test'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 404 when source does not exist', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'fileRemove',
      source: 'non-existent-source',
      name: 'test.txt'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain('Source not found');
  });

  it('should remove file from subdirectory', async () => {
    // Create test file in subdirectory
    const testFileName = 'subdir-file.txt';
    await createTestFile(testFileName, 'content in subdir', '/subdir');

    const response = await request(testServer!.host).get('/').query({
      action: 'fileRemove',
      source: 'test',
      path: '/subdir',
      name: testFileName
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should reject path traversal attempts', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'fileRemove',
      source: 'test',
      name: '../../../etc/passwd'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it('should return 400 when trying to remove directory', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'fileRemove',
      source: 'test',
      name: 'subdir'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain('It is not a file!');
  });

  describe('Access Control', () => {
    let aclTestServer: TestServer | null = null;

    afterEach(async () => {
      if (aclTestServer) {
        await stopTestServer(aclTestServer);
        aclTestServer = null;
      }
    });

    it('should allow access when no access control rules defined', async () => {
      aclTestServer = await startTestServer();
      await createTestFile('acl-test.txt', 'test content');

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'fileRemove', source: 'test', name: 'acl-test.txt' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should deny access when role does not have FILE_REMOVE permission', async () => {
      aclTestServer = await startTestServer({
        sources: {
          test: {
            name: 'test',
            title: 'Test Files',
            root: './files/test',
            baseurl: 'http://localhost:8081/files/test/'
          }
        },
        accessControl: [
          {
            role: 'guest',
            FILE_REMOVE: false
          }
        ],
        defaultRole: 'guest'
      });

      await createTestFile('test.txt', 'content');

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'fileRemove', source: 'test', name: 'test.txt' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.data.code).toBe(403);
      expect(response.body.data.messages).toContain('Access denied');
    });

    it('should allow access when role has FILE_REMOVE permission', async () => {
      aclTestServer = await startTestServer({
        sources: {
          test: {
            name: 'test',
            title: 'Test Files',
            root: './files/test',
            baseurl: 'http://localhost:8081/files/test/'
          }
        },
        accessControl: [
          {
            role: 'admin',
            FILE_REMOVE: true
          }
        ],
        defaultRole: 'admin'
      });

      await createTestFile('test.txt', 'content');

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'fileRemove', source: 'test', name: 'test.txt' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should check path-based permissions for FILE_REMOVE action', async () => {
      aclTestServer = await startTestServer({
        sources: {
          test: {
            name: 'test',
            title: 'Test Files',
            root: './files/test',
            baseurl: 'http://localhost:8081/files/test/'
          }
        },
        accessControl: [
          {
            role: 'guest',
            FILE_REMOVE: true
          },
          {
            role: 'guest',
            path: '/subdir',
            FILE_REMOVE: false
          }
        ],
        defaultRole: 'guest'
      });

      await createTestFile('public.txt', 'public content');
      await createTestFile('protected.txt', 'protected content', '/subdir');

      // Should allow removal in root path
      const rootResponse = await request(aclTestServer!.host)
        .get('/')
        .query({
          action: 'fileRemove',
          source: 'test',
          path: '/',
          name: 'public.txt'
        });

      expect(rootResponse.status).toBe(200);
      expect(rootResponse.body.success).toBe(true);

      // Should deny removal in /subdir path
      const subdirResponse = await request(aclTestServer!.host)
        .get('/')
        .query({
          action: 'fileRemove',
          source: 'test',
          path: '/subdir',
          name: 'protected.txt'
        });

      expect(subdirResponse.status).toBe(403);
      expect(subdirResponse.body.success).toBe(false);
      expect(subdirResponse.body.data.messages).toContain('Access denied');
    });

    it('should use wildcard role to deny FILE_REMOVE access to all roles', async () => {
      aclTestServer = await startTestServer({
        sources: {
          test: {
            name: 'test',
            title: 'Test Files',
            root: './files/test',
            baseurl: 'http://localhost:8081/files/test/'
          }
        },
        accessControl: [
          {
            role: '*',
            FILE_REMOVE: false
          }
        ],
        defaultRole: 'guest'
      });

      await createTestFile('test.txt', 'content');

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'fileRemove', source: 'test', name: 'test.txt' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.data.messages).toContain('Access denied');
    });

    it('should work with POST method', async () => {
      aclTestServer = await startTestServer({
        sources: {
          test: {
            name: 'test',
            title: 'Test Files',
            root: './files/test',
            baseurl: 'http://localhost:8081/files/test/'
          }
        },
        accessControl: [
          {
            role: 'guest',
            FILE_REMOVE: false
          }
        ],
        defaultRole: 'guest'
      });

      await createTestFile('test.txt', 'content');

      const response = await request(aclTestServer!.host).post('/').send({
        action: 'fileRemove',
        source: 'test',
        name: 'test.txt'
      });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.data.messages).toContain('Access denied');
    });
  });
});
