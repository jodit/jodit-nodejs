import type * as http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { startTestServer, stopTestServer } from '../test-server';
import { createApp } from '../../app';

describe('File Upload API', () => {
  let server: http.Server;
  const testFilesPath = path.join(__dirname, '../../../files/test');
  const app = createApp({
    sources: {
      test: {
        title: 'Test Files',
        root: testFilesPath,
        baseurl: 'http://localhost:3000/files/test/'
      }
    }
  });

  beforeAll(async () => {
    // Create test directory structure
    await fs.mkdir(testFilesPath, { recursive: true });

    [server] = await startTestServer(app);
  });

  afterAll(async () => {
    await stopTestServer(server);
    // Clean up test files
    await fs.rm(path.join(__dirname, '../../../files/test'), {
      recursive: true,
      force: true
    });
  });

  describe('POST /?action=fileUpload', () => {
    it('should upload multiple files successfully', async () => {
      const testImagePath = path.join(testFilesPath, './test-image.png');
      const testCsvPath = path.join(testFilesPath, './test-file.csv');

      // Create test files
      await fs.writeFile(testImagePath, 'fake image content');
      await fs.writeFile(testCsvPath, 'test,csv,content');

      const response = await request(app)
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

      const response = await request(app)
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
      const response = await request(app)
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

      const response = await request(app)
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
      const response1 = await request(app)
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
      const response2 = await request(app)
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

    it.only('should handle same filename with addNumber strategy', async () => {
      const testFilePath = path.join(testFilesPath, './test-number.txt');
      await fs.writeFile(testFilePath, 'content');

      // Upload first time
      const response1 = await request(app)
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
      const response2 = await request(app)
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
  });
});
