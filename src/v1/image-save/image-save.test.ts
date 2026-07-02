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

describe('Image Save (POST /?action=imageSave)', () => {
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

  async function createImageBuffer(
    width: number,
    height: number,
    color: { r: number; g: number; b: number }
  ): Promise<Buffer> {
    return sharp({
      create: { width, height, channels: 3, background: color }
    })
      .png()
      .toBuffer();
  }

  it('should save an edited image as a new file (newname)', async () => {
    const edited = await createImageBuffer(120, 90, { r: 0, g: 200, b: 0 });

    const response = await request(testServer!.host)
      .post('/')
      .field('action', 'imageSave')
      .field('source', 'test')
      .field('newname', 'edited-image.png')
      .attach('files[0]', edited, {
        filename: 'edited-image.png',
        contentType: 'image/png'
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        code: 220,
        name: 'edited-image.png'
      }
    });
    expect(response.body.data.newPath).toContain('edited-image.png');

    const savedPath = path.join(testFilesPath, 'edited-image.png');
    const meta = await sharp(savedPath).metadata();
    expect(meta.width).toBe(120);
    expect(meta.height).toBe(90);
  });

  it('should overwrite the original file when only name is given', async () => {
    // Seed an original image.
    const original = await createImageBuffer(50, 50, { r: 255, g: 0, b: 0 });
    await fs.writeFile(path.join(testFilesPath, 'orig.png'), original);

    const edited = await createImageBuffer(200, 150, { r: 0, g: 0, b: 255 });

    const response = await request(testServer!.host)
      .post('/')
      .field('action', 'imageSave')
      .field('source', 'test')
      .field('name', 'orig.png')
      .attach('files[0]', edited, {
        filename: 'orig.png',
        contentType: 'image/png'
      });

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe('orig.png');

    const meta = await sharp(path.join(testFilesPath, 'orig.png')).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(150);
  });

  it('should delete the stale cached thumbnail when overwriting a file', async () => {
    // Seed an original file and a cached thumbnail (as the file browser would
    // have generated on a previous listing).
    const original = await createImageBuffer(50, 50, { r: 255, g: 0, b: 0 });
    await fs.writeFile(path.join(testFilesPath, 'orig.png'), original);

    const thumbsDir = path.join(testFilesPath, '_thumbs');
    await fs.mkdir(thumbsDir, { recursive: true });
    const thumbPath = path.join(thumbsDir, 'orig.png');
    await fs.writeFile(thumbPath, original);

    // Sanity: the stale thumbnail exists before the edit.
    await expect(fs.access(thumbPath)).resolves.toBeUndefined();

    const edited = await createImageBuffer(200, 150, { r: 0, g: 0, b: 255 });

    const response = await request(testServer!.host)
      .post('/')
      .field('action', 'imageSave')
      .field('source', 'test')
      .field('name', 'orig.png')
      .attach('files[0]', edited, {
        filename: 'orig.png',
        contentType: 'image/png'
      });

    expect(response.status).toBe(200);

    // The stale thumbnail must be gone so the browser regenerates a fresh one
    // from the just-saved bytes on the next listing.
    await expect(fs.access(thumbPath)).rejects.toThrow();
  });

  it('should return 400 when no image is uploaded', async () => {
    const response = await request(testServer!.host)
      .post('/')
      .field('action', 'imageSave')
      .field('source', 'test')
      .field('newname', 'nothing.png');

    expect(response.status).toBe(400);
  });

  it('should return 400 for non-image bytes', async () => {
    const response = await request(testServer!.host)
      .post('/')
      .field('action', 'imageSave')
      .field('source', 'test')
      .field('newname', 'broken.png')
      .attach('files[0]', Buffer.from('this is not an image'), {
        filename: 'broken.png',
        contentType: 'image/png'
      });

    expect(response.status).toBe(400);
  });

  it('should reject a GET request (POST only)', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'imageSave',
      source: 'test',
      newname: 'x.png'
    });

    expect(response.status).toBe(405);
    expect(response.body.success).not.toBe(true);
  });
});
