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
});
