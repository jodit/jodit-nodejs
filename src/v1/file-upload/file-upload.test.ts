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

    it('should handle same filename with replace strategy', async () => {
      const testFilePath = path.join(testFilesPath, './test-same.txt');
      await fs.writeFile(testFilePath, 'content 1');

      // Upload first time
      const response1 = await request(testServer!.host)
        .post(
          '/?custom_config=' +
            encodeURIComponent(
              JSON.stringify({ saveSameFileNameStrategy: 'replace' })
            )
        )
        .field('action', 'fileUpload')
        .field('source', 'test')
        .attach('files', testFilePath);

      expect(response1.status).toBe(200);

      // Update file content
      await fs.writeFile(testFilePath, 'content 2');

      // Upload again with same name
      const response2 = await request(testServer!.host)
        .post(
          '/?custom_config=' +
            encodeURIComponent(
              JSON.stringify({ saveSameFileNameStrategy: 'replace' })
            )
        )
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

      // Cleanup
      await fs.unlink(testFilePath);
    });

    it('should handle same filename with addNumber strategy', async () => {
      const testFilePath = path.join(testFilesPath, './test-number.txt');
      await fs.writeFile(testFilePath, 'content');

      // Upload first time
      const response1 = await request(testServer!.host)
        .post(
          '/?custom_config=' +
            encodeURIComponent(
              JSON.stringify({ saveSameFileNameStrategy: 'addNumber' })
            )
        )
        .field('action', 'fileUpload')
        .field('source', 'test')
        .attach('files', testFilePath);

      expect(response1.status).toBe(200);

      // Upload again with same name
      const response2 = await request(testServer!.host)
        .post(
          '/?custom_config=' +
            encodeURIComponent(
              JSON.stringify({ saveSameFileNameStrategy: 'addNumber' })
            )
        )
        .field('action', 'fileUpload')
        .field('source', 'test')
        .attach('files', testFilePath);

      expect(response2.status).toBe(200);
      expect(response2.body.data.files[0]).toMatch(/test-number(-\d+)?\.txt/);

      // Cleanup
      await fs.unlink(testFilePath);
    });

    it('should return error when file exists and strategy is error', async () => {
      // Create file in subdir for uploading
      const testFilePath = path.join(testFilesPath, './subdir/test-error.txt');
      await fs.writeFile(testFilePath, 'original content');

      // Upload first file successfully
      const response1 = await request(testServer!.host)
        .post(
          '/?custom_config=' +
            encodeURIComponent(
              JSON.stringify({ saveSameFileNameStrategy: 'error' })
            )
        )
        .field('action', 'fileUpload')
        .field('source', 'test')
        .attach('files', testFilePath);

      expect(response1.status).toBe(200);
      expect(response1.body.success).toBe(true);

      // Try to upload again with same name - should fail
      const response2 = await request(testServer!.host)
        .post(
          '/?custom_config=' +
            encodeURIComponent(
              JSON.stringify({ saveSameFileNameStrategy: 'error' })
            )
        )
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

      // Cleanup
      await fs.unlink(testFilePath).catch(() => {});
      await fs
        .unlink(path.join(testFilesPath, 'test-error.txt'))
        .catch(() => {});
    });
  });
});
