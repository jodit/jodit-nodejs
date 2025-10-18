import request from 'supertest';
import {
  startTestServer,
  stopTestServer,
  cleanupTestFiles,
  TestServer
} from '../../tests/test-server';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

describe('Image Crop (GET /?action=imageCrop)', () => {
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
    await fs.mkdir(testFilesPath, { recursive: true });
  });

  afterEach(async () => {
    await cleanupTestFiles();
  });

  // Helper to create a test image
  async function createTestImage(
    filename: string,
    width: number = 200,
    height: number = 200
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

  it('should crop image successfully', async () => {
    await createTestImage('test-image.png', 200, 200);

    const response = await request(testServer!.host).get('/').query({
      action: 'imageCrop',
      source: 'test',
      name: 'test-image.png',
      'box[x]': '50',
      'box[y]': '50',
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

    // Verify image was cropped
    const imagePath = path.join(testFilesPath, 'test-image.png');
    const metadata = await sharp(imagePath).metadata();
    expect(metadata.width).toBe(100);
    expect(metadata.height).toBe(100);
  });

  it('should crop image with new name', async () => {
    await createTestImage('original.png', 200, 200);

    const response = await request(testServer!.host).get('/').query({
      action: 'imageCrop',
      source: 'test',
      name: 'original.png',
      newname: 'cropped.png',
      'box[x]': '25',
      'box[y]': '25',
      'box[w]': '50',
      'box[h]': '50'
    });

    expect(response.status).toBe(200);

    // Verify new image was created
    const croppedPath = path.join(testFilesPath, 'cropped.png');
    const exists = await fs
      .access(croppedPath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);

    const metadata = await sharp(croppedPath).metadata();
    expect(metadata.width).toBe(50);
    expect(metadata.height).toBe(50);

    // Original should still exist and unchanged
    const originalExists = await fs
      .access(path.join(testFilesPath, 'original.png'))
      .then(() => true)
      .catch(() => false);
    expect(originalExists).toBe(true);
    const originalMetadata = await sharp(
      path.join(testFilesPath, 'original.png')
    ).metadata();
    expect(originalMetadata.width).toBe(200);
  });

  it('should preserve extension when new name provided', async () => {
    await createTestImage('test.png', 100, 100);

    const response = await request(testServer!.host).get('/').query({
      action: 'imageCrop',
      source: 'test',
      name: 'test.png',
      newname: 'cropped',
      'box[x]': '10',
      'box[y]': '10',
      'box[w]': '80',
      'box[h]': '80'
    });

    expect(response.status).toBe(200);

    // Should have added .png extension
    const croppedPath = path.join(testFilesPath, 'cropped.png');
    const exists = await fs
      .access(croppedPath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it('should crop from corner (x=0, y=0)', async () => {
    await createTestImage('test.png', 200, 200);

    const response = await request(testServer!.host).get('/').query({
      action: 'imageCrop',
      source: 'test',
      name: 'test.png',
      'box[x]': '0',
      'box[y]': '0',
      'box[w]': '100',
      'box[h]': '100'
    });

    expect(response.status).toBe(200);

    const metadata = await sharp(
      path.join(testFilesPath, 'test.png')
    ).metadata();
    expect(metadata.width).toBe(100);
    expect(metadata.height).toBe(100);
  });

  it('should return 400 when width is missing', async () => {
    await createTestImage('test.png');

    const response = await request(testServer!.host).get('/').query({
      action: 'imageCrop',
      source: 'test',
      name: 'test.png',
      'box[x]': '10',
      'box[y]': '10',
      'box[h]': '100'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 400 when height is missing', async () => {
    await createTestImage('test.png');

    const response = await request(testServer!.host).get('/').query({
      action: 'imageCrop',
      source: 'test',
      name: 'test.png',
      'box[x]': '10',
      'box[y]': '10',
      'box[w]': '100'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 400 when x coordinate is missing', async () => {
    await createTestImage('test.png');

    const response = await request(testServer!.host).get('/').query({
      action: 'imageCrop',
      source: 'test',
      name: 'test.png',
      'box[y]': '10',
      'box[w]': '100',
      'box[h]': '100'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 400 when y coordinate is missing', async () => {
    await createTestImage('test.png');

    const response = await request(testServer!.host).get('/').query({
      action: 'imageCrop',
      source: 'test',
      name: 'test.png',
      'box[x]': '10',
      'box[w]': '100',
      'box[h]': '100'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 400 when width is zero or negative', async () => {
    await createTestImage('test.png');

    const response = await request(testServer!.host).get('/').query({
      action: 'imageCrop',
      source: 'test',
      name: 'test.png',
      'box[x]': '10',
      'box[y]': '10',
      'box[w]': '0',
      'box[h]': '100'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 400 when x coordinate is negative', async () => {
    await createTestImage('test.png');

    const response = await request(testServer!.host).get('/').query({
      action: 'imageCrop',
      source: 'test',
      name: 'test.png',
      'box[x]': '-10',
      'box[y]': '10',
      'box[w]': '100',
      'box[h]': '100'
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 404 when image does not exist', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'imageCrop',
      source: 'test',
      name: 'non-existent.png',
      'box[x]': '10',
      'box[y]': '10',
      'box[w]': '100',
      'box[h]': '100'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain('File not exists');
  });

  it('should return 404 when source does not exist', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'imageCrop',
      source: 'non-existent-source',
      name: 'test.png',
      'box[x]': '10',
      'box[y]': '10',
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
      action: 'imageCrop',
      source: 'test',
      name: 'test.jpg',
      'box[x]': '50',
      'box[y]': '50',
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
      action: 'imageCrop',
      source: 'test',
      name: '../../../etc/passwd',
      'box[x]': '10',
      'box[y]': '10',
      'box[w]': '100',
      'box[h]': '100'
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
      await createTestImage('acl-test.png', 200, 200);

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({
          action: 'imageCrop',
          source: 'test',
          name: 'acl-test.png',
          'box[x]': '10',
          'box[y]': '10',
          'box[w]': '100',
          'box[h]': '100'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should deny access when role does not have IMAGE_CROP permission', async () => {
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
            IMAGE_CROP: false
          }
        ],
        defaultRole: 'guest'
      });

      await createTestImage('test.png', 200, 200);

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({
          action: 'imageCrop',
          source: 'test',
          name: 'test.png',
          'box[x]': '10',
          'box[y]': '10',
          'box[w]': '100',
          'box[h]': '100'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.data.code).toBe(403);
      expect(response.body.data.messages).toContain('Access denied');
    });

    it('should allow access when role has IMAGE_CROP permission', async () => {
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
            IMAGE_CROP: true
          }
        ],
        defaultRole: 'admin'
      });

      await createTestImage('test.png', 200, 200);

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({
          action: 'imageCrop',
          source: 'test',
          name: 'test.png',
          'box[x]': '10',
          'box[y]': '10',
          'box[w]': '100',
          'box[h]': '100'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should check path-based permissions for IMAGE_CROP action', async () => {
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
            IMAGE_CROP: true
          },
          {
            role: 'guest',
            path: '/secure',
            IMAGE_CROP: false
          }
        ],
        defaultRole: 'guest'
      });

      await createTestImage('public.png', 200, 200);
      await fs.mkdir(path.join(testFilesPath, 'secure'), { recursive: true });
      const securePath = path.join(testFilesPath, 'secure', 'private.png');
      await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toFile(securePath);

      // Should allow crop in root path
      const rootResponse = await request(aclTestServer!.host)
        .get('/')
        .query({
          action: 'imageCrop',
          source: 'test',
          path: '/',
          name: 'public.png',
          'box[x]': '10',
          'box[y]': '10',
          'box[w]': '100',
          'box[h]': '100'
        });

      expect(rootResponse.status).toBe(200);
      expect(rootResponse.body.success).toBe(true);

      // Should deny crop in /secure path
      const secureResponse = await request(aclTestServer!.host)
        .get('/')
        .query({
          action: 'imageCrop',
          source: 'test',
          path: '/secure',
          name: 'private.png',
          'box[x]': '10',
          'box[y]': '10',
          'box[w]': '100',
          'box[h]': '100'
        });

      expect(secureResponse.status).toBe(403);
      expect(secureResponse.body.success).toBe(false);
      expect(secureResponse.body.data.messages).toContain('Access denied');
    });

    it('should use wildcard role to deny IMAGE_CROP access to all roles', async () => {
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
            IMAGE_CROP: false
          }
        ],
        defaultRole: 'guest'
      });

      await createTestImage('test.png', 200, 200);

      const response = await request(aclTestServer!.host)
        .get('/')
        .query({
          action: 'imageCrop',
          source: 'test',
          name: 'test.png',
          'box[x]': '10',
          'box[y]': '10',
          'box[w]': '100',
          'box[h]': '100'
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
            IMAGE_CROP: false
          }
        ],
        defaultRole: 'guest'
      });

      await createTestImage('test.png', 200, 200);

      const response = await request(aclTestServer!.host)
        .post('/')
        .send({
          action: 'imageCrop',
          source: 'test',
          name: 'test.png',
          box: { x: 10, y: 10, w: 100, h: 100 }
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.data.messages).toContain('Access denied');
    });
  });
});
