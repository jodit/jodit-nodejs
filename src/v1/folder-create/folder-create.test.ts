import request from 'supertest';
import {
  startTestServer,
  stopTestServer,
  cleanupTestFiles,
  TestServer,
  createTestDirectories
} from '../../tests/test-server';
import fs from 'fs/promises';
import path from 'path';

describe('Folder Create (GET /?action=folderCreate)', () => {
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

  it('should create a new folder successfully', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'folderCreate',
      source: 'test',
      name: 'new-folder'
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        code: 220,
        messages: ['Directory successfully created']
      }
    });

    // Verify folder was created
    const folderPath = path.join(testFilesPath, 'new-folder');
    const stats = await fs.stat(folderPath);
    expect(stats.isDirectory()).toBe(true);
  });

  it('should create folder in subdirectory', async () => {
    // Create parent directory first
    const parentDir = path.join(testFilesPath, 'parent');
    await fs.mkdir(parentDir, { recursive: true });

    const response = await request(testServer!.host).get('/').query({
      action: 'folderCreate',
      source: 'test',
      path: '/parent',
      name: 'child-folder'
    });

    expect(response.status).toBe(200);
    expect(response.body.data.messages).toContain(
      'Directory successfully created'
    );

    // Verify folder was created
    const folderPath = path.join(parentDir, 'child-folder');
    const stats = await fs.stat(folderPath);
    expect(stats.isDirectory()).toBe(true);
  });

  it('should sanitize folder name with dangerous characters', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'folderCreate',
      source: 'test',
      name: 'folder:with*special?chars'
    });

    expect(response.status).toBe(200);

    // Verify folder was created with sanitized name
    const folderPath = path.join(testFilesPath, 'folder_with_special_chars');
    const stats = await fs.stat(folderPath);
    expect(stats.isDirectory()).toBe(true);
  });

  it('should return 400 when name parameter is missing', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'folderCreate',
      source: 'test'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 400 when name is empty string', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'folderCreate',
      source: 'test',
      name: ''
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 400 when folder already exists', async () => {
    // Create folder first
    const folderPath = path.join(testFilesPath, 'existing-folder');
    await fs.mkdir(folderPath, { recursive: true });

    const response = await request(testServer!.host).get('/').query({
      action: 'folderCreate',
      source: 'test',
      name: 'existing-folder'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain('Directory already exists');
  });

  it('should return 404 when source does not exist', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'folderCreate',
      source: 'non-existent-source',
      name: 'new-folder'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain('Source not found');
  });

  it('should return 404 when parent directory does not exist', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'folderCreate',
      source: 'test',
      path: '/non-existent-parent',
      name: 'new-folder'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain('Directory not found');
  });

  it('should prevent path traversal attack', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'folderCreate',
      source: 'test',
      path: '/../../etc',
      name: 'malicious-folder'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it('should handle folder names with spaces', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'folderCreate',
      source: 'test',
      name: 'folder with spaces'
    });

    expect(response.status).toBe(200);

    // Verify folder was created
    const folderPath = path.join(testFilesPath, 'folder with spaces');
    const stats = await fs.stat(folderPath);
    expect(stats.isDirectory()).toBe(true);
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

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'folderCreate', source: 'test', name: 'acl-test-folder' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should deny access when role does not have FOLDER_CREATE permission', async () => {
      aclTestServer = await startTestServer({
        sources: {
          test: {
            name: 'test',
            title: 'Test Files',
            root: testFilesPath,
            baseurl: 'http://localhost:8081/files/test/'
          }
        },
        accessControl: [
          {
            role: 'guest',
            FOLDER_CREATE: false
          }
        ],
        defaultRole: 'guest'
      });

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'folderCreate', source: 'test', name: 'new-folder' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.data.code).toBe(403);
      expect(response.body.data.messages).toContain('Access denied');
    });

    it('should allow access when role has FOLDER_CREATE permission', async () => {
      aclTestServer = await startTestServer({
        sources: {
          test: {
            name: 'test',
            title: 'Test Files',
            root: testFilesPath,
            baseurl: 'http://localhost:8081/files/test/'
          }
        },
        accessControl: [
          {
            role: 'admin',
            FOLDER_CREATE: true
          }
        ],
        defaultRole: 'admin'
      });

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'folderCreate', source: 'test', name: 'new-folder' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should check path-based permissions for FOLDER_CREATE action', async () => {
      aclTestServer = await startTestServer({
        sources: {
          test: {
            name: 'test',
            title: 'Test Files',
            root: testFilesPath,
            baseurl: 'http://localhost:8081/files/test/'
          }
        },
        accessControl: [
          {
            role: 'guest',
            FOLDER_CREATE: true
          },
          {
            role: 'guest',
            path: '/restricted',
            FOLDER_CREATE: false
          }
        ],
        defaultRole: 'guest'
      });

      await fs.mkdir(path.join(testFilesPath, 'restricted'), { recursive: true });

      // Should allow folder creation in root path
      const rootResponse = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'folderCreate', source: 'test', path: '/', name: 'public-folder' });

      expect(rootResponse.status).toBe(200);
      expect(rootResponse.body.success).toBe(true);

      // Should deny folder creation in /restricted path
      const restrictedResponse = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'folderCreate', source: 'test', path: '/restricted', name: 'blocked-folder' });

      expect(restrictedResponse.status).toBe(403);
      expect(restrictedResponse.body.success).toBe(false);
      expect(restrictedResponse.body.data.messages).toContain('Access denied');
    });

    it('should use wildcard role to deny FOLDER_CREATE access to all roles', async () => {
      aclTestServer = await startTestServer({
        sources: {
          test: {
            name: 'test',
            title: 'Test Files',
            root: testFilesPath,
            baseurl: 'http://localhost:8081/files/test/'
          }
        },
        accessControl: [
          {
            role: '*',
            FOLDER_CREATE: false
          }
        ],
        defaultRole: 'guest'
      });

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'folderCreate', source: 'test', name: 'new-folder' });

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
            root: testFilesPath,
            baseurl: 'http://localhost:8081/files/test/'
          }
        },
        accessControl: [
          {
            role: 'guest',
            FOLDER_CREATE: false
          }
        ],
        defaultRole: 'guest'
      });

      const response = await request(aclTestServer!.host)
        .post('/')
        .send({
          action: 'folderCreate',
          source: 'test',
          name: 'new-folder'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.data.messages).toContain('Access denied');
    });
  });
});
