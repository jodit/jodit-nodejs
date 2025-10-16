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
import sharp from 'sharp';

describe('Image Resize (GET /?action=imageResize)', () => {
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

  // Helper to create a test image
  async function createTestImage(
    filename: string,
    width: number = 100,
    height: number = 100
  ): Promise<void> {
    const imagePath = path.join(testFilesPath, filename);
    await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    })
      .png()
      .toFile(imagePath);
  }

  it('should resize image successfully', async () => {
    await createTestImage('test-image.png', 200, 200);

    const response = await request(testServer!.host).get('/').query({
      action: 'imageResize',
      source: 'test',
      name: 'test-image.png',
      'box[w]': '100',
      'box[h]': '100'
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        code: 220
      }
    });

    // Verify image was resized
    const imagePath = path.join(testFilesPath, 'test-image.png');
    const metadata = await sharp(imagePath).metadata();
    expect(metadata.width).toBe(100);
    expect(metadata.height).toBe(100);
  });

  it('should resize image with new name', async () => {
    await createTestImage('original.png', 200, 200);

    const response = await request(testServer!.host).get('/').query({
      action: 'imageResize',
      source: 'test',
      name: 'original.png',
      newname: 'resized.png',
      'box[w]': '50',
      'box[h]': '50'
    });

    expect(response.status).toBe(200);

    // Verify new image was created
    const resizedPath = path.join(testFilesPath, 'resized.png');
    const exists = await fs
      .access(resizedPath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);

    const metadata = await sharp(resizedPath).metadata();
    expect(metadata.width).toBe(50);
    expect(metadata.height).toBe(50);

    // Original should still exist
    const originalExists = await fs
      .access(path.join(testFilesPath, 'original.png'))
      .then(() => true)
      .catch(() => false);
    expect(originalExists).toBe(true);
  });

  it('should preserve extension when new name provided', async () => {
    await createTestImage('test.png', 100, 100);

    const response = await request(testServer!.host).get('/').query({
      action: 'imageResize',
      source: 'test',
      name: 'test.png',
      newname: 'resized',
      'box[w]': '80',
      'box[h]': '80'
    });

    expect(response.status).toBe(200);

    // Should have added .png extension
    const resizedPath = path.join(testFilesPath, 'resized.png');
    const exists = await fs
      .access(resizedPath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it('should return 400 when width is missing', async () => {
    await createTestImage('test.png');

    const response = await request(testServer!.host).get('/').query({
      action: 'imageResize',
      source: 'test',
      name: 'test.png',
      'box[h]': '100'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 400 when height is missing', async () => {
    await createTestImage('test.png');

    const response = await request(testServer!.host).get('/').query({
      action: 'imageResize',
      source: 'test',
      name: 'test.png',
      'box[w]': '100'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 400 when width is zero or negative', async () => {
    await createTestImage('test.png');

    const response = await request(testServer!.host).get('/').query({
      action: 'imageResize',
      source: 'test',
      name: 'test.png',
      'box[w]': '0',
      'box[h]': '100'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 404 when image does not exist', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'imageResize',
      source: 'test',
      name: 'non-existent.png',
      'box[w]': '100',
      'box[h]': '100'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain('File not exists');
  });

  it('should return 404 when source does not exist', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'imageResize',
      source: 'non-existent-source',
      name: 'test.png',
      'box[w]': '100',
      'box[h]': '100'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain('Source not found');
  });

  it('should handle JPEG images', async () => {
    // Create a JPEG test image
    const imagePath = path.join(testFilesPath, 'test.jpg');
    await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 3,
        background: { r: 0, g: 255, b: 0 }
      }
    })
      .jpeg()
      .toFile(imagePath);

    const response = await request(testServer!.host).get('/').query({
      action: 'imageResize',
      source: 'test',
      name: 'test.jpg',
      'box[w]': '100',
      'box[h]': '100'
    });

    expect(response.status).toBe(200);

    const metadata = await sharp(imagePath).metadata();
    expect(metadata.width).toBe(100);
    expect(metadata.height).toBe(100);
  });

  it('should prevent path traversal attack', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'imageResize',
      source: 'test',
      name: '../../../etc/passwd',
      'box[w]': '100',
      'box[h]': '100'
    });

    expect(response.status).  toBe(404);
    expect(response.body.success).toBe(false);
  });
});
