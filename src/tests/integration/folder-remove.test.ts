import request from 'supertest';
import { Application } from 'express';
import { createTestApp, cleanupTestFiles } from '../test-server';
import fs from 'fs/promises';
import path from 'path';

describe('Folder Remove (GET /?action=folderRemove)', () => {
  let app: Application;
  const testFilesPath = path.join(__dirname, '../../../files/test');

  beforeEach(async () => {
    app = createTestApp();
    await cleanupTestFiles();
  });

  afterEach(async () => {
    await cleanupTestFiles();
  });

  it('should remove an empty folder successfully', async () => {
    // Create folder first
    const folderPath = path.join(testFilesPath, 'folder-to-remove');
    await fs.mkdir(folderPath, { recursive: true });

    const response = await request(app).get('/').query({
      action: 'folderRemove',
      source: 'test',
      name: 'folder-to-remove'
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        code: 220
      }
    });

    // Verify folder was removed
    const exists = await fs
      .access(folderPath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  it('should remove folder with files', async () => {
    // Create folder with files
    const folderPath = path.join(testFilesPath, 'folder-with-files');
    await fs.mkdir(folderPath, { recursive: true });
    await fs.writeFile(path.join(folderPath, 'file1.txt'), 'content 1');
    await fs.writeFile(path.join(folderPath, 'file2.txt'), 'content 2');

    const response = await request(app).get('/').query({
      action: 'folderRemove',
      source: 'test',
      name: 'folder-with-files'
    });

    expect(response.status).toBe(200);

    // Verify folder was removed
    const exists = await fs
      .access(folderPath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  it('should remove folder with subdirectories', async () => {
    // Create nested folder structure
    const folderPath = path.join(testFilesPath, 'parent-folder');
    const subFolder1 = path.join(folderPath, 'sub1');
    const subFolder2 = path.join(folderPath, 'sub2');
    await fs.mkdir(subFolder1, { recursive: true });
    await fs.mkdir(subFolder2, { recursive: true });
    await fs.writeFile(path.join(subFolder1, 'file.txt'), 'content');
    await fs.writeFile(path.join(subFolder2, 'file.txt'), 'content');

    const response = await request(app).get('/').query({
      action: 'folderRemove',
      source: 'test',
      name: 'parent-folder'
    });

    expect(response.status).toBe(200);

    // Verify folder was removed
    const exists = await fs
      .access(folderPath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  it('should remove folder in subdirectory', async () => {
    // Create parent directory and subfolder
    const parentDir = path.join(testFilesPath, 'parent');
    const folderPath = path.join(parentDir, 'child-folder');
    await fs.mkdir(folderPath, { recursive: true });

    const response = await request(app).get('/').query({
      action: 'folderRemove',
      source: 'test',
      path: '/parent',
      name: 'child-folder'
    });

    expect(response.status).toBe(200);

    // Verify folder was removed
    const exists = await fs
      .access(folderPath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  it('should remove folder with thumbnails directory', async () => {
    // Create folder with _thumbs subdirectory
    const folderPath = path.join(testFilesPath, 'folder-with-thumbs');
    const thumbsPath = path.join(folderPath, '_thumbs');
    await fs.mkdir(thumbsPath, { recursive: true });
    await fs.writeFile(path.join(thumbsPath, 'thumb1.jpg'), 'thumb');

    const response = await request(app).get('/').query({
      action: 'folderRemove',
      source: 'test',
      name: 'folder-with-thumbs'
    });

    expect(response.status).toBe(200);

    // Verify folder was removed
    const exists = await fs
      .access(folderPath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  it('should return 400 when name parameter is missing', async () => {
    const response = await request(app).get('/').query({
      action: 'folderRemove',
      source: 'test'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 404 when source does not exist', async () => {
    const response = await request(app).get('/').query({
      action: 'folderRemove',
      source: 'non-existent-source',
      name: 'some-folder'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain('Source not found');
  });

  it('should return 404 when folder does not exist', async () => {
    const response = await request(app).get('/').query({
      action: 'folderRemove',
      source: 'test',
      name: 'non-existent-folder'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain('Directory not exists');
  });

  it('should return 400 when trying to remove a file instead of folder', async () => {
    // Create a file
    const filePath = path.join(testFilesPath, 'test-file.txt');
    await fs.writeFile(filePath, 'content');

    const response = await request(app).get('/').query({
      action: 'folderRemove',
      source: 'test',
      name: 'test-file.txt'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain('It is not a directory!');
  });

  it('should prevent path traversal attack', async () => {
    const response = await request(app).get('/').query({
      action: 'folderRemove',
      source: 'test',
      path: '/../../etc',
      name: 'passwd'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });
});
