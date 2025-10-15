import request from 'supertest';
import {
  startTestServer,
  stopTestServer,
  cleanupTestFiles,
  createTestFile,
  createTestDirectories,
  TestServer
} from '../../tests/test-server';
import fs from 'fs/promises';
import path from 'path';

describe('File Rename (GET /?action=fileRename)', () => {
  let testServer: TestServer | null = null;
  const testFilesPath = path.join(process.cwd(), './files/test');

  beforeAll(async () => {
    testServer = await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer(testServer!);
  });

  beforeEach(async () => {
    await cleanupTestFiles();
    await createTestDirectories();
  });

  it('should rename file successfully', async () => {
    // Create test file
    const oldName = 'old-name.txt';
    const newName = 'new-name.txt';
    await createTestFile(oldName, 'content to rename');

    const response = await request(testServer!.host).get('/').query({
      action: 'fileRename',
      source: 'test',
      name: oldName,
      newname: newName
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        code: 220
      }
    });

    // Verify file was renamed
    const oldPath = path.join(testFilesPath, oldName);
    const newPath = path.join(testFilesPath, newName);

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

  it('should preserve file extension when renaming', async () => {
    // Create test file
    const oldName = 'document.pdf';
    const newName = 'renamed-doc'; // без расширения
    await createTestFile(oldName, 'pdf content');

    const response = await request(testServer!.host).get('/').query({
      action: 'fileRename',
      source: 'test',
      name: oldName,
      newname: newName
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify extension was preserved
    const expectedNewPath = path.join(testFilesPath, `${newName}.pdf`);
    const exists = await fs
      .access(expectedNewPath)
      .then(() => true)
      .catch(() => false);

    expect(exists).toBe(true);
  });

  it('should rename folder successfully', async () => {
    // Create test folder
    const oldName = 'old-folder';
    const newName = 'new-folder';
    await createTestFile('inner.txt', 'content', `/${oldName}`);

    const response = await request(testServer!.host).get('/').query({
      action: 'fileRename',
      source: 'test',
      name: oldName,
      newname: newName
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify folder was renamed
    const oldPath = path.join(testFilesPath, oldName);
    const newPath = path.join(testFilesPath, newName);

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

  it('should return 404 when file does not exist', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'fileRename',
      source: 'test',
      name: 'non-existent.txt',
      newname: 'new-name.txt'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain('Path not exists');
  });

  it('should return 400 when newname parameter is missing', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'fileRename',
      source: 'test',
      name: 'file.txt'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 400 when name parameter is missing', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'fileRename',
      source: 'test',
      newname: 'new-name.txt'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 404 when source does not exist', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'fileRename',
      source: 'non-existent-source',
      name: 'file.txt',
      newname: 'new-name.txt'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain('Source not found');
  });

  it('should return 400 when new name already exists', async () => {
    // Create two files
    await createTestFile('file1.txt', 'content 1');
    await createTestFile('file2.txt', 'content 2');

    const response = await request(testServer!.host).get('/').query({
      action: 'fileRename',
      source: 'test',
      name: 'file1.txt',
      newname: 'file2.txt'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages[0]).toContain('already exists');
  });

  it('should rename file in subdirectory', async () => {
    // Create file in subdirectory
    const oldName = 'old-file.txt';
    const newName = 'new-file.txt';
    await createTestFile(oldName, 'content', '/subdir');

    const response = await request(testServer!.host).get('/').query({
      action: 'fileRename',
      source: 'test',
      path: '/subdir',
      name: oldName,
      newname: newName
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify file was renamed
    const oldPath = path.join(testFilesPath, 'subdir', oldName);
    const newPath = path.join(testFilesPath, 'subdir', newName);

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

  it('should auto-add safe extension when renaming to dangerous extension', async () => {
    // Create test file
    const oldName = 'safe-file.jpg';
    const dangerousNewName = 'malicious.php';
    await createTestFile(oldName, 'image content');

    const response = await request(testServer!.host).get('/').query({
      action: 'fileRename',
      source: 'test',
      name: oldName,
      newname: dangerousNewName
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify file was renamed with .jpg appended to dangerous extension
    const expectedPath = path.join(testFilesPath, 'malicious.php.jpg');
    const dangerousPath = path.join(testFilesPath, 'malicious.php');

    const safeExists = await fs
      .access(expectedPath)
      .then(() => true)
      .catch(() => false);
    const dangerousExists = await fs
      .access(dangerousPath)
      .then(() => true)
      .catch(() => false);

    expect(safeExists).toBe(true);
    expect(dangerousExists).toBe(false);
  });
});
