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

describe('Folder Move (GET /?action=folderMove)', () => {
  let testServer: TestServer | null = null;
  const testFilesPath = path.join(__dirname, '../../../files/test');

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

  it('should move an empty folder successfully', async () => {
    // Create source folder in subfolder and destination directory
    const parentDir = path.join(testFilesPath, 'parent');
    const sourceFolder = path.join(parentDir, 'folder-to-move');
    await fs.mkdir(sourceFolder, { recursive: true });

    const response = await request(testServer!.host).get('/').query({
      action: 'folderMove',
      source: 'test',
      from: '/parent/folder-to-move',
      path: '/'
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        code: 220
      }
    });

    // Verify folder was moved to root
    const oldExists = await fs
      .access(sourceFolder)
      .then(() => true)
      .catch(() => false);
    const newExists = await fs
      .access(path.join(testFilesPath, 'folder-to-move'))
      .then(() => true)
      .catch(() => false);
    expect(oldExists).toBe(false);
    expect(newExists).toBe(true);
  });

  it('should move folder to a different directory', async () => {
    // Create source folder and destination directory
    const sourceFolder = path.join(testFilesPath, 'folder-to-move');
    const destDir = path.join(testFilesPath, 'destination');
    await fs.mkdir(sourceFolder, { recursive: true });
    await fs.mkdir(destDir, { recursive: true });

    const response = await request(testServer!.host).get('/').query({
      action: 'folderMove',
      source: 'test',
      from: '/folder-to-move',
      path: '/destination/'
    });

    expect(response.status).toBe(200);

    // Verify folder was moved
    const sourceExists = await fs
      .access(sourceFolder)
      .then(() => true)
      .catch(() => false);
    const destExists = await fs
      .access(path.join(destDir, 'folder-to-move'))
      .then(() => true)
      .catch(() => false);
    expect(sourceExists).toBe(false);
    expect(destExists).toBe(true);
  });

  it('should move folder with files', async () => {
    // Create source folder with files
    const sourceFolder = path.join(testFilesPath, 'folder-with-files');
    const destDir = path.join(testFilesPath, 'destination');
    await fs.mkdir(sourceFolder, { recursive: true });
    await fs.mkdir(destDir, { recursive: true });
    await fs.writeFile(path.join(sourceFolder, 'file1.txt'), 'content 1');
    await fs.writeFile(path.join(sourceFolder, 'file2.txt'), 'content 2');

    const response = await request(testServer!.host).get('/').query({
      action: 'folderMove',
      source: 'test',
      from: '/folder-with-files',
      path: '/destination/'
    });

    expect(response.status).toBe(200);

    // Verify folder and files were moved
    const destFolder = path.join(destDir, 'folder-with-files');
    const file1Exists = await fs
      .access(path.join(destFolder, 'file1.txt'))
      .then(() => true)
      .catch(() => false);
    const file2Exists = await fs
      .access(path.join(destFolder, 'file2.txt'))
      .then(() => true)
      .catch(() => false);
    expect(file1Exists).toBe(true);
    expect(file2Exists).toBe(true);
  });

  it('should move folder with subdirectories', async () => {
    // Create nested folder structure
    const sourceFolder = path.join(testFilesPath, 'parent-folder');
    const subFolder = path.join(sourceFolder, 'sub-folder');
    const destDir = path.join(testFilesPath, 'destination');
    await fs.mkdir(subFolder, { recursive: true });
    await fs.mkdir(destDir, { recursive: true });
    await fs.writeFile(path.join(subFolder, 'file.txt'), 'content');

    const response = await request(testServer!.host).get('/').query({
      action: 'folderMove',
      source: 'test',
      from: '/parent-folder',
      path: '/destination/'
    });

    expect(response.status).toBe(200);

    // Verify nested structure was moved
    const destFolder = path.join(destDir, 'parent-folder', 'sub-folder');
    const fileExists = await fs
      .access(path.join(destFolder, 'file.txt'))
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);
  });

  it('should return 400 when from parameter is missing', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'folderMove',
      source: 'test',
      path: '/destination/'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 404 when source does not exist', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'folderMove',
      source: 'non-existent-source',
      from: '/folder',
      path: '/'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain('Source not found');
  });

  it('should return 404 when folder does not exist', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'folderMove',
      source: 'test',
      from: '/non-existent-folder',
      path: '/'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain(
      'Folder or directory not exists'
    );
  });

  it('should return 404 when destination directory does not exist', async () => {
    // Create source folder
    const sourceFolder = path.join(testFilesPath, 'folder-to-move');
    await fs.mkdir(sourceFolder, { recursive: true });

    const response = await request(testServer!.host).get('/').query({
      action: 'folderMove',
      source: 'test',
      from: '/folder-to-move',
      path: '/non-existent-destination/'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain(
      'Destination directory not found'
    );
  });

  it('should return 400 when destination folder already exists', async () => {
    // Create source folder and destination with same name
    const sourceFolder = path.join(testFilesPath, 'folder-to-move');
    const destDir = path.join(testFilesPath, 'destination');
    const destFolder = path.join(destDir, 'folder-to-move');
    await fs.mkdir(sourceFolder, { recursive: true });
    await fs.mkdir(destFolder, { recursive: true });

    const response = await request(testServer!.host).get('/').query({
      action: 'folderMove',
      source: 'test',
      from: '/folder-to-move',
      path: '/destination/'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain(
      'Folder with same name already exists in destination'
    );
  });

  it('should prevent path traversal attack', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'folderMove',
      source: 'test',
      from: '/../../etc/passwd',
      path: '/'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });
});
