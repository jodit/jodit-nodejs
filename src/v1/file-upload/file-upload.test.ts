import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import {
  startTestServer,
  stopTestServer,
  TestServer
} from '../../tests/test-server';

describe('File Upload API', () => {
  let testServer: TestServer | null = null;
  const testFilesPath = path.join(process.cwd(), './files/test');

  beforeAll(async () => {
    testServer = await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer(testServer!);
  });

  describe('POST /?action=fileUpload', () => {
    it('should upload multiple files successfully', async () => {
      const testImagePath = path.join(testFilesPath, './subdir/test-image.png');
      const testCsvPath = path.join(testFilesPath, './subdir/test-file.csv');

      // Create test files
      await fs.writeFile(testImagePath, 'fake image content');
      await fs.writeFile(testCsvPath, 'test,csv,content');

      const response = await request(testServer!.host)
        .post('/')
        .field('action', 'fileUpload')
        .field('source', 'test')
        .attach('files', testImagePath)
        .attach('files', testCsvPath);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          code: 220,
          files: expect.arrayContaining(['test-image.png', 'test-file.csv']),
          isImages: expect.any(Array)
        }
      });

      // Cleanup test files
      await fs.unlink(testImagePath);
      await fs.unlink(testCsvPath);
    });

    it('should reject upload of forbidden file extensions', async () => {
      const testPhpPath = path.join(testFilesPath, './test.php');
      await fs.writeFile(testPhpPath, '<?php echo "test"; ?>');

      const response = await request(testServer!.host)
        .post('/')
        .field('action', 'fileUpload')
        .field('source', 'test')
        .attach('files', testPhpPath);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        data: {
          code: 403
        }
      });

      // Cleanup
      await fs.unlink(testPhpPath);
    });

    it('should return 400 when no files are uploaded', async () => {
      const response = await request(testServer!.host)
        .post('/')
        .field('action', 'fileUpload')
        .field('source', 'test');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        data: {
          code: 400
        }
      });
    });

    it('should return 404 for non-existent source', async () => {
      const testImagePath = path.join(testFilesPath, './test-upload.png');
      await fs.writeFile(testImagePath, 'fake image');

      const response = await request(testServer!.host)
        .post('/')
        .field('action', 'fileUpload')
        .field('source', 'nonexistent')
        .attach('files', testImagePath);

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        data: {
          code: 404
        }
      });

      // Cleanup
      await fs.unlink(testImagePath);
    });

    it('should handle same filename with addNumber strategy (default)', async () => {
      const testFilePath = path.join(testFilesPath, './test-number.txt');
      await fs.writeFile(testFilePath, 'content');

      // Upload first time
      const response1 = await request(testServer!.host)
        .post('/')
        .field('action', 'fileUpload')
        .field('source', 'test')
        .attach('files', testFilePath);

      expect(response1.status).toBe(200);

      // Upload again with same name
      const response2 = await request(testServer!.host)
        .post('/')
        .field('action', 'fileUpload')
        .field('source', 'test')
        .attach('files', testFilePath);

      expect(response2.status).toBe(200);
      expect(response2.body.data.files[0]).toMatch(/test-number(-\d+)?\.txt/);

      // Cleanup
      await fs.unlink(testFilePath);
    });

    it('should upload files with array-style field names (files[0], files[1])', async () => {
      const testImagePath = path.join(testFilesPath, './subdir/test-array-1.png');
      const testCsvPath = path.join(testFilesPath, './subdir/test-array-2.csv');

      // Create test files
      await fs.writeFile(testImagePath, 'fake image content');
      await fs.writeFile(testCsvPath, 'test,csv,content');

      // Simulate browser FormData with array-style field names
      const response = await request(testServer!.host)
        .post('/')
        .field('action', 'fileUpload')
        .field('source', 'test')
        .attach('files[0]', testImagePath)
        .attach('files[1]', testCsvPath);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          code: 220,
          files: expect.arrayContaining(['test-array-1.png', 'test-array-2.csv']),
          isImages: expect.any(Array)
        }
      });

      // Cleanup test files
      await fs.unlink(testImagePath);
      await fs.unlink(testCsvPath);
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
        const testImagePath = path.join(testFilesPath, 'subdir', 'acl-test.png');
        await fs.writeFile(testImagePath, 'test image content');

        const response = await request(aclTestServer!.host)
          .post('/')
          .field('action', 'fileUpload')
          .field('source', 'test')
          .attach('files', testImagePath);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        await fs.unlink(testImagePath);
      });

      it('should deny access when role does not have FILE_UPLOAD permission', async () => {
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
              FILE_UPLOAD: false
            }
          ],
          defaultRole: 'guest'
        });

        const testImagePath = path.join(testFilesPath, 'subdir', 'test.png');
        await fs.writeFile(testImagePath, 'test image');

        const response = await request(aclTestServer!.host)
          .post('/')
          .field('action', 'fileUpload')
          .field('source', 'test')
          .attach('files', testImagePath);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.data.code).toBe(403);
        expect(response.body.data.messages).toContain('Access denied');

        await fs.unlink(testImagePath);
      });

      it('should allow access when role has FILE_UPLOAD permission', async () => {
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
              FILE_UPLOAD: true
            }
          ],
          defaultRole: 'admin'
        });

        const testImagePath = path.join(testFilesPath, 'subdir', 'test.png');
        await fs.writeFile(testImagePath, 'test image');

        const response = await request(aclTestServer!.host)
          .post('/')
          .field('action', 'fileUpload')
          .field('source', 'test')
          .attach('files', testImagePath);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        await fs.unlink(testImagePath);
      });

      it('should check path-based permissions for FILE_UPLOAD action', async () => {
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
              FILE_UPLOAD: true
            },
            {
              role: 'guest',
              path: '/restricted',
              FILE_UPLOAD: false
            }
          ],
          defaultRole: 'guest'
        });

        const publicImagePath = path.join(testFilesPath, 'subdir', 'public.png');
        const restrictedImagePath = path.join(testFilesPath, 'subdir', 'restricted.png');
        await fs.writeFile(publicImagePath, 'public image');
        await fs.writeFile(restrictedImagePath, 'restricted image');

        // Should allow upload in root path
        const rootResponse = await request(aclTestServer!.host)
          .post('/')
          .field('action', 'fileUpload')
          .field('source', 'test')
          .field('path', '/')
          .attach('files', publicImagePath);

        expect(rootResponse.status).toBe(200);
        expect(rootResponse.body.success).toBe(true);

        // Should deny upload in /restricted path
        const restrictedResponse = await request(aclTestServer!.host)
          .post('/')
          .field('action', 'fileUpload')
          .field('source', 'test')
          .field('path', '/restricted')
          .attach('files', restrictedImagePath);

        expect(restrictedResponse.status).toBe(403);
        expect(restrictedResponse.body.success).toBe(false);
        expect(restrictedResponse.body.data.messages).toContain('Access denied');

        await fs.unlink(publicImagePath);
        await fs.unlink(restrictedImagePath);
      });

      it('should use wildcard role to deny FILE_UPLOAD access to all roles', async () => {
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
              FILE_UPLOAD: false
            }
          ],
          defaultRole: 'guest'
        });

        const testImagePath = path.join(testFilesPath, 'subdir', 'test.png');
        await fs.writeFile(testImagePath, 'test image');

        const response = await request(aclTestServer!.host)
          .post('/')
          .field('action', 'fileUpload')
          .field('source', 'test')
          .attach('files', testImagePath);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.data.messages).toContain('Access denied');

        await fs.unlink(testImagePath);
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
              FILE_UPLOAD: false
            }
          ],
          defaultRole: 'guest'
        });

        const testImagePath = path.join(testFilesPath, 'subdir', 'test.png');
        await fs.writeFile(testImagePath, 'test image');

        const response = await request(aclTestServer!.host)
          .post('/')
          .field('action', 'fileUpload')
          .field('source', 'test')
          .attach('files', testImagePath);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.data.messages).toContain('Access denied');

        await fs.unlink(testImagePath);
      });
    });
  });
});

describe('File Upload API - Replace Strategy', () => {
  let testServer: TestServer | null = null;
  const testFilesPath = path.join(process.cwd(), './files/test-replace');

  beforeAll(async () => {
    testServer = await startTestServer({
      saveSameFileNameStrategy: 'replace',
      sources: {
        test: {
          name: 'test',
          title: 'Test Files',
          root: testFilesPath,
          baseurl: 'http://localhost:8081/files/test/',
          defaultFilesKey: 'files'
        }
      }
    });
    await fs.mkdir(testFilesPath, { recursive: true });
  });

  afterAll(async () => {
    await stopTestServer(testServer!);
    await fs.rm(testFilesPath, { recursive: true, force: true });
  });

  it('should handle same filename with replace strategy', async () => {
    const testFilePath = path.join(testFilesPath, 'test-same.txt');
    await fs.writeFile(testFilePath, 'content 1');

    // Upload first time
    const response1 = await request(testServer!.host)
      .post('/')
      .field('action', 'fileUpload')
      .field('source', 'test')
      .attach('files', testFilePath);

    expect(response1.status).toBe(200);

    // Update file content
    await fs.writeFile(testFilePath, 'content 2');

    // Upload again with same name
    const response2 = await request(testServer!.host)
      .post('/')
      .field('action', 'fileUpload')
      .field('source', 'test')
      .attach('files', testFilePath);

    expect(response2.status).toBe(200);
    expect(response2.body).toMatchObject({
      success: true,
      data: {
        code: 220,
        files: ['test-same.txt']
      }
    });

    // Verify the file was replaced
    const uploadedContent = await fs.readFile(
      path.join(testFilesPath, 'test-same.txt'),
      'utf-8'
    );
    expect(uploadedContent).toBe('content 2');
  });
});

describe('File Upload API - Error Strategy', () => {
  let testServer: TestServer | null = null;
  const testFilesPath = path.join(process.cwd(), './files/test-error');

  beforeAll(async () => {
    testServer = await startTestServer({
      saveSameFileNameStrategy: 'error',
      sources: {
        test: {
          name: 'test',
          title: 'Test Files',
          root: testFilesPath,
          baseurl: 'http://localhost:8081/files/test/',
          defaultFilesKey: 'files'
        }
      }
    });
    await fs.mkdir(testFilesPath, { recursive: true });
    await fs.mkdir(path.join(testFilesPath, 'subdir'), { recursive: true });
  });

  afterAll(async () => {
    await stopTestServer(testServer!);
    await fs.rm(testFilesPath, { recursive: true, force: true });
  });

  it('should return error when file exists and strategy is error', async () => {
    // Create file in subdir for uploading
    const testFilePath = path.join(testFilesPath, 'subdir', 'test-error.txt');
    await fs.writeFile(testFilePath, 'original content');

    // Upload first file successfully
    const response1 = await request(testServer!.host)
      .post('/')
      .field('action', 'fileUpload')
      .field('source', 'test')
      .attach('files', testFilePath);

    expect(response1.status).toBe(200);
    expect(response1.body.success).toBe(true);

    // Try to upload again with same name - should fail
    const response2 = await request(testServer!.host)
      .post('/')
      .field('action', 'fileUpload')
      .field('source', 'test')
      .attach('files', testFilePath);

    expect(response2.status).toBe(400);
    expect(response2.body).toMatchObject({
      success: false,
      data: {
        code: 400,
        messages: expect.arrayContaining([
          expect.stringContaining('already exists')
        ])
      }
    });
  });
});
