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

describe('Folder Rename (GET /?action=folderRename)', () => {
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

  it('should rename an empty folder successfully', async () => {
    // Create folder
    const oldPath = path.join(testFilesPath, 'old-folder-name');
    await fs.mkdir(oldPath, { recursive: true });

    const response = await request(testServer!.host).get('/').query({
      action: 'folderRename',
      source: 'test',
      name: 'old-folder-name',
      newname: 'new-folder-name'
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        code: 220
      }
    });

    // Verify folder was renamed
    const oldExists = await fs
      .access(oldPath)
      .then(() => true)
      .catch(() => false);
    const newExists = await fs
      .access(path.join(testFilesPath, 'new-folder-name'))
      .then(() => true)
      .catch(() => false);
    expect(oldExists).toBe(false);
    expect(newExists).toBe(true);
  });

  it('should rename folder with files', async () => {
    // Create folder with files
    const oldPath = path.join(testFilesPath, 'folder-with-files');
    await fs.mkdir(oldPath, { recursive: true });
    await fs.writeFile(path.join(oldPath, 'file1.txt'), 'content 1');
    await fs.writeFile(path.join(oldPath, 'file2.txt'), 'content 2');

    const response = await request(testServer!.host).get('/').query({
      action: 'folderRename',
      source: 'test',
      name: 'folder-with-files',
      newname: 'renamed-folder'
    });

    expect(response.status).toBe(200);

    // Verify folder and files were renamed
    const newPath = path.join(testFilesPath, 'renamed-folder');
    const file1Exists = await fs
      .access(path.join(newPath, 'file1.txt'))
      .then(() => true)
      .catch(() => false);
    const file2Exists = await fs
      .access(path.join(newPath, 'file2.txt'))
      .then(() => true)
      .catch(() => false);
    expect(file1Exists).toBe(true);
    expect(file2Exists).toBe(true);
  });

  it('should rename folder with subdirectories', async () => {
    // Create nested folder structure
    const oldPath = path.join(testFilesPath, 'parent-folder');
    const subFolder = path.join(oldPath, 'sub-folder');
    await fs.mkdir(subFolder, { recursive: true });
    await fs.writeFile(path.join(subFolder, 'file.txt'), 'content');

    const response = await request(testServer!.host).get('/').query({
      action: 'folderRename',
      source: 'test',
      name: 'parent-folder',
      newname: 'renamed-parent'
    });

    expect(response.status).toBe(200);

    // Verify nested structure was renamed
    const newPath = path.join(testFilesPath, 'renamed-parent', 'sub-folder');
    const fileExists = await fs
      .access(path.join(newPath, 'file.txt'))
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);
  });

  it('should rename folder in subdirectory', async () => {
    // Create parent directory and folder
    const parentDir = path.join(testFilesPath, 'parent');
    const oldPath = path.join(parentDir, 'old-folder');
    await fs.mkdir(oldPath, { recursive: true });

    const response = await request(testServer!.host).get('/').query({
      action: 'folderRename',
      source: 'test',
      path: '/parent',
      name: 'old-folder',
      newname: 'new-folder'
    });

    expect(response.status).toBe(200);

    // Verify folder was renamed
    const oldExists = await fs
      .access(oldPath)
      .then(() => true)
      .catch(() => false);
    const newExists = await fs
      .access(path.join(parentDir, 'new-folder'))
      .then(() => true)
      .catch(() => false);
    expect(oldExists).toBe(false);
    expect(newExists).toBe(true);
  });

  it('should return 400 when name parameter is missing', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'folderRename',
      source: 'test',
      newname: 'new-name'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 400 when newname parameter is missing', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'folderRename',
      source: 'test',
      name: 'old-name'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 404 when source does not exist', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'folderRename',
      source: 'non-existent-source',
      name: 'folder',
      newname: 'new-name'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain('Source not found');
  });

  it('should return 404 when folder does not exist', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'folderRename',
      source: 'test',
      name: 'non-existent-folder',
      newname: 'new-name'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain(
      'Folder or directory not exists'
    );
  });

  it('should return 400 when new name already exists', async () => {
    // Create two folders
    const folder1 = path.join(testFilesPath, 'folder1');
    const folder2 = path.join(testFilesPath, 'folder2');
    await fs.mkdir(folder1, { recursive: true });
    await fs.mkdir(folder2, { recursive: true });

    const response = await request(testServer!.host).get('/').query({
      action: 'folderRename',
      source: 'test',
      name: 'folder1',
      newname: 'folder2'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain(
      'Folder with new name already exists'
    );
  });

  it('should prevent path traversal attack', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'folderRename',
      source: 'test',
      path: '/../../etc',
      name: 'passwd',
      newname: 'hacked'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
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
      await fs.mkdir(path.join(testFilesPath, 'acl-folder'), {
        recursive: true
      });

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({
          action: 'folderRename',
          source: 'test',
          name: 'acl-folder',
          newname: 'renamed-folder'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should deny access when role does not have FOLDER_RENAME permission', async () => {
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
            FOLDER_RENAME: false
          }
        ],
        defaultRole: 'guest'
      });

      await fs.mkdir(path.join(testFilesPath, 'test-folder'), {
        recursive: true
      });

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({
          action: 'folderRename',
          source: 'test',
          name: 'test-folder',
          newname: 'renamed-folder'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.data.code).toBe(403);
      expect(response.body.data.messages).toContain('Access denied');
    });

    it('should allow access when role has FOLDER_RENAME permission', async () => {
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
            FOLDER_RENAME: true
          }
        ],
        defaultRole: 'admin'
      });

      await fs.mkdir(path.join(testFilesPath, 'test-folder'), {
        recursive: true
      });

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({
          action: 'folderRename',
          source: 'test',
          name: 'test-folder',
          newname: 'renamed-folder'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should check path-based permissions for FOLDER_RENAME action', async () => {
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
            FOLDER_RENAME: true
          },
          {
            role: 'guest',
            path: '/locked',
            FOLDER_RENAME: false
          }
        ],
        defaultRole: 'guest'
      });

      await fs.mkdir(path.join(testFilesPath, 'public'), { recursive: true });
      await fs.mkdir(path.join(testFilesPath, 'locked', 'private'), {
        recursive: true
      });

      // Should allow rename in root path
      const rootResponse = await request(aclTestServer!.host)
        .get('/')
        .query({
          action: 'folderRename',
          source: 'test',
          path: '/',
          name: 'public',
          newname: 'public-renamed'
        });

      expect(rootResponse.status).toBe(200);
      expect(rootResponse.body.success).toBe(true);

      // Should deny rename in /locked path
      const lockedResponse = await request(aclTestServer!.host)
        .get('/')
        .query({
          action: 'folderRename',
          source: 'test',
          path: '/locked',
          name: 'private',
          newname: 'private-renamed'
        });

      expect(lockedResponse.status).toBe(403);
      expect(lockedResponse.body.success).toBe(false);
      expect(lockedResponse.body.data.messages).toContain('Access denied');
    });

    it('should use wildcard role to deny FOLDER_RENAME access to all roles', async () => {
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
            FOLDER_RENAME: false
          }
        ],
        defaultRole: 'guest'
      });

      await fs.mkdir(path.join(testFilesPath, 'test-folder'), {
        recursive: true
      });

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({
          action: 'folderRename',
          source: 'test',
          name: 'test-folder',
          newname: 'renamed-folder'
        });

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
            FOLDER_RENAME: false
          }
        ],
        defaultRole: 'guest'
      });

      await fs.mkdir(path.join(testFilesPath, 'test-folder'), {
        recursive: true
      });

      const response = await request(aclTestServer!.host).post('/').send({
        action: 'folderRename',
        source: 'test',
        name: 'test-folder',
        newname: 'renamed-folder'
      });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.data.messages).toContain('Access denied');
    });
  });
});
