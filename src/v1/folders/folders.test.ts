import request from 'supertest';
import {
  startTestServer,
  stopTestServer,
  TestServer
} from '../../tests/test-server';
import fs from 'fs/promises';
import path from 'path';

describe('Folders (GET /?action=folders)', () => {
  let testServer: TestServer | null = null;
  const testFilesPath = path.join(process.cwd(), './files/test');

  beforeAll(async () => {
    testServer = await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer(testServer!);
  });

  it('should return empty folders list for empty directory', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'folders',
      source: 'test'
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.code).toBe(220);
    expect(response.body.data.sources).toHaveLength(1);
    expect(response.body.data.sources[0].name).toBe('test');
    expect(response.body.data.sources[0].folders.length).toBeGreaterThanOrEqual(
      0
    );
  });

  it('should return list of folders', async () => {
    // Create some folders
    await fs.mkdir(path.join(testFilesPath, 'folder1'), { recursive: true });
    await fs.mkdir(path.join(testFilesPath, 'folder2'), { recursive: true });
    await fs.mkdir(path.join(testFilesPath, 'folder3'), { recursive: true });

    const response = await request(testServer!.host).get('/').query({
      action: 'folders',
      source: 'test'
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.sources[0].folders).toEqual(
      expect.arrayContaining(['folder1', 'folder2', 'folder3'])
    );
  });

  it('should exclude thumbnail folders from list', async () => {
    // Create folders including thumbnail folder
    await fs.mkdir(path.join(testFilesPath, 'folder1'), { recursive: true });
    await fs.mkdir(path.join(testFilesPath, '_thumbs'), { recursive: true });

    const response = await request(testServer!.host).get('/').query({
      action: 'folders',
      source: 'test'
    });

    expect(response.status).toBe(200);
    expect(response.body.data.sources[0].folders).toContain('folder1');
    expect(response.body.data.sources[0].folders).not.toContain('_thumbs');
  });

  it('should include parent directory (..) when not at root', async () => {
    // Create subfolder
    const subDir = path.join(testFilesPath, 'parent');
    await fs.mkdir(subDir, { recursive: true });

    const response = await request(testServer!.host).get('/').query({
      action: 'folders',
      source: 'test',
      path: '/parent'
    });

    expect(response.status).toBe(200);
    expect(response.body.data.sources[0].folders).toContain('..');
  });

  it('should not include parent directory (..) when at root', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'folders',
      source: 'test',
      path: '/'
    });

    expect(response.status).toBe(200);
    expect(response.body.data.sources[0].folders).not.toContain('..');
  });

  it('should not include files in folders list', async () => {
    // Create folders and files
    await fs.mkdir(path.join(testFilesPath, 'folder1'), { recursive: true });
    await fs.writeFile(path.join(testFilesPath, 'file1.txt'), 'content');

    const response = await request(testServer!.host).get('/').query({
      action: 'folders',
      source: 'test'
    });

    expect(response.status).toBe(200);
    expect(response.body.data.sources[0].folders).toContain('folder1');
    expect(response.body.data.sources[0].folders).not.toContain('file1.txt');
  });

  it('should handle nested folders', async () => {
    // Create nested structure
    const parentDir = path.join(testFilesPath, 'parent');
    const childDir = path.join(parentDir, 'child');
    await fs.mkdir(childDir, { recursive: true });

    const response = await request(testServer!.host).get('/').query({
      action: 'folders',
      source: 'test',
      path: '/parent'
    });

    expect(response.status).toBe(200);
    expect(response.body.data.sources[0].folders).toContain('child');
  });

  it('should return 404 with empty list for non-existent path', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'folders',
      source: 'test',
      path: '/non-existent'
    });

    expect(response.status).toBe(404);
  });

  it('should return 404 with empty list for non-existent source', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'folders',
      source: 'non-existent-source'
    });

    expect(response.status).toBe(404);
  });

  it('should handle dots parameter', async () => {
    // Create subfolder
    const subDir = path.join(testFilesPath, 'parent');
    await fs.mkdir(subDir, { recursive: true });

    // Test with dots=false
    const response = await request(testServer!.host).get('/').query({
      action: 'folders',
      source: 'test',
      path: '/parent',
      dots: false
    });

    expect(response.status).toBe(200);
    expect(response.body.data.sources[0].folders).not.toContain('..');
    expect(response.body.data.sources[0].name).toEqual('test');
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
      await fs.mkdir(path.join(testFilesPath, 'test-folder'), {
        recursive: true
      });

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'folders', source: 'test' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should deny access when role does not have FOLDERS permission', async () => {
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
            FOLDERS: false
          }
        ],
        defaultRole: 'guest'
      });

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'folders', source: 'test' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.data.code).toBe(403);
      expect(response.body.data.messages).toContain('Access denied');
    });

    it('should allow access when role has FOLDERS permission', async () => {
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
            FOLDERS: true
          }
        ],
        defaultRole: 'admin'
      });

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'folders', source: 'test' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should check path-based permissions for FOLDERS action', async () => {
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
            FOLDERS: true
          },
          {
            role: 'guest',
            path: '/private',
            FOLDERS: false
          }
        ],
        defaultRole: 'guest'
      });

      await fs.mkdir(path.join(testFilesPath, 'private'), { recursive: true });

      // Should allow access to root path
      const rootResponse = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'folders', source: 'test', path: '/' });

      expect(rootResponse.status).toBe(200);
      expect(rootResponse.body.success).toBe(true);

      // Should deny access to /private path
      const privateResponse = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'folders', source: 'test', path: '/private' });

      expect(privateResponse.status).toBe(403);
      expect(privateResponse.body.success).toBe(false);
      expect(privateResponse.body.data.messages).toContain('Access denied');
    });

    it('should use wildcard role to deny FOLDERS access to all roles', async () => {
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
            FOLDERS: false
          }
        ],
        defaultRole: 'guest'
      });

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({ action: 'folders', source: 'test' });

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
            FOLDERS: false
          }
        ],
        defaultRole: 'guest'
      });

      const response = await request(aclTestServer!.host)
        .post('/')
        .send({
          action: 'folders',
          source: 'test'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.data.messages).toContain('Access denied');
    });
  });
});
