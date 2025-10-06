import request from 'supertest';
import { Application } from 'express';
import {
  createTestApp,
  cleanupTestFiles,
  createTestFile
} from '../test-server';

describe('File Remove (GET /?action=fileRemove)', () => {
  let app: Application;

  beforeEach(async () => {
    app = createTestApp();
    await cleanupTestFiles();
  });

  afterEach(async () => {
    await cleanupTestFiles();
  });

  it('should remove file successfully', async () => {
    // Create test file
    const testFileName = 'test-remove.txt';
    await createTestFile(testFileName, 'content to remove');

    const response = await request(app).get('/').query({
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
    const response = await request(app).get('/').query({
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
    const response = await request(app).get('/').query({
      action: 'fileRemove',
      source: 'test'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 404 when source does not exist', async () => {
    const response = await request(app).get('/').query({
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

    const response = await request(app).get('/').query({
      action: 'fileRemove',
      source: 'test',
      path: '/subdir',
      name: testFileName
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should reject path traversal attempts', async () => {
    const response = await request(app).get('/').query({
      action: 'fileRemove',
      source: 'test',
      name: '../../../etc/passwd'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it('should return 400 when trying to remove directory', async () => {
    const response = await request(app).get('/').query({
      action: 'fileRemove',
      source: 'test',
      name: 'subdir'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain('It is not a file!');
  });
});
