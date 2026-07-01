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

describe('Image Load (POST /?action=imageLoad)', () => {
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

  it('should return the image as a base64 data URL', async () => {
    const png = await sharp({
      create: {
        width: 40,
        height: 30,
        channels: 3,
        background: { r: 10, g: 20, b: 30 }
      }
    })
      .png()
      .toBuffer();
    await fs.writeFile(path.join(testFilesPath, 'photo.png'), png);

    const response = await request(testServer!.host)
      .post('/')
      .field('action', 'imageLoad')
      .field('source', 'test')
      .field('name', 'photo.png');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { code: 220, name: 'photo.png' }
    });
    expect(response.body.data.content).toMatch(/^data:image\/png;base64,/);

    // The returned data URL decodes back to the same image.
    const base64 = response.body.data.content.split(',')[1];
    const meta = await sharp(Buffer.from(base64, 'base64')).metadata();
    expect(meta.width).toBe(40);
    expect(meta.height).toBe(30);
  });

  it('should return 404 for a missing file', async () => {
    const response = await request(testServer!.host)
      .post('/')
      .field('action', 'imageLoad')
      .field('source', 'test')
      .field('name', 'nope.png');

    expect(response.status).toBe(404);
  });

  it('should return 400 when name is missing', async () => {
    const response = await request(testServer!.host)
      .post('/')
      .field('action', 'imageLoad')
      .field('source', 'test');

    expect(response.status).toBe(400);
  });
});
