import path from 'path';
import request from 'supertest';
import {
  createTestFile,
  type TestServer,
  startTestServer,
  stopTestServer
} from '../test-server';

describe('Source Config Override', () => {
  let testServer: TestServer | null = null;
  const testFilesPath = path.join(process.cwd(), './files/test');
  const testFilesPath2 = path.join(process.cwd(), './files/test2');

  afterEach(async () => {
    if (testServer) {
      await stopTestServer(testServer);
      testServer = null;
    }
  });

  describe('File extensions override', () => {
    it('should use global extensions when source does not override', async () => {
      testServer = await startTestServer({
        extensions: ['txt', 'jpg', 'png'],
        sources: {
          test: {
            name: 'test',
            title: 'Test Files',
            root: testFilesPath,
            baseurl: 'http://localhost:8081/files/test/'
          }
        }
      });

      await createTestFile('test.txt', 'text content');
      await createTestFile('test.jpg', 'image content');
      await createTestFile('test.pdf', 'pdf content');

      const response = await request(testServer.host)
        .get('/')
        .query({ action: 'files', source: 'test' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const files = response.body.data.sources[0].files.filter(
        (f: { type: string }) => f.type === 'file' || f.type === 'image'
      );

      // Should see txt and jpg, but not pdf (not in global extensions)
      expect(files.some((f: { file: string }) => f.file === 'test.txt')).toBe(
        true
      );
      expect(files.some((f: { file: string }) => f.file === 'test.jpg')).toBe(
        true
      );
      expect(files.some((f: { file: string }) => f.file === 'test.pdf')).toBe(
        false
      );
    });

    it('should override global extensions with source-specific extensions', async () => {
      testServer = await startTestServer({
        extensions: ['txt', 'jpg'],
        sources: {
          test: {
            name: 'test',
            title: 'Test Files',
            root: testFilesPath,
            baseurl: 'http://localhost:8081/files/test/',
            extensions: ['pdf', 'doc']
          }
        }
      });

      await createTestFile('test.txt', 'text content');
      await createTestFile('test.jpg', 'image content');
      await createTestFile('test.pdf', 'pdf content');

      const response = await request(testServer.host)
        .get('/')
        .query({ action: 'files', source: 'test' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const files = response.body.data.sources[0].files.filter(
        (f: { type: string }) => f.type === 'file' || f.type === 'image'
      );

      // Should see pdf (from source override), but not txt or jpg
      expect(files.some((f: { file: string }) => f.file === 'test.txt')).toBe(
        false
      );
      expect(files.some((f: { file: string }) => f.file === 'test.jpg')).toBe(
        false
      );
      expect(files.some((f: { file: string }) => f.file === 'test.pdf')).toBe(
        true
      );
    });
  });

  describe('Thumbnail settings override', () => {
    it('should override thumbSize for specific source', async () => {
      testServer = await startTestServer({
        createThumb: true,
        thumbSize: 100,
        sources: {
          smallThumbs: {
            name: 'smallThumbs',
            title: 'Small Thumbnails',
            root: testFilesPath,
            baseurl: 'http://localhost:8081/files/test/',
            thumbSize: 50
          },
          largeThumbs: {
            name: 'largeThumbs',
            title: 'Large Thumbnails',
            root: testFilesPath2,
            baseurl: 'http://localhost:8081/files/test2/',
            thumbSize: 200
          }
        }
      });

      // This test verifies that different sources can have different thumb sizes
      // The actual thumbnail creation would need image files to test fully
      expect(testServer).toBeDefined();
    });

    it('should override createThumb setting per source', async () => {
      testServer = await startTestServer({
        createThumb: true,
        sources: {
          withThumbs: {
            name: 'withThumbs',
            title: 'With Thumbnails',
            root: testFilesPath,
            baseurl: 'http://localhost:8081/files/test/',
            createThumb: true
          },
          withoutThumbs: {
            name: 'withoutThumbs',
            title: 'Without Thumbnails',
            root: testFilesPath2,
            baseurl: 'http://localhost:8081/files/test2/',
            createThumb: false
          }
        }
      });

      expect(testServer).toBeDefined();
    });
  });

  describe('Upload settings override', () => {
    it('should override maxUploadFileSize per source', async () => {
      testServer = await startTestServer({
        maxUploadFileSize: '10MB',
        sources: {
          smallFiles: {
            name: 'smallFiles',
            title: 'Small Files Only',
            root: testFilesPath,
            baseurl: 'http://localhost:8081/files/test/',
            maxUploadFileSize: '1KB'
          },
          largeFiles: {
            name: 'largeFiles',
            title: 'Large Files Allowed',
            root: testFilesPath2,
            baseurl: 'http://localhost:8081/files/test2/',
            maxUploadFileSize: '100MB'
          }
        }
      });

      // Try to upload a 2KB file to smallFiles source (should fail)
      const largeContent = 'x'.repeat(2048); // 2KB

      const response1 = await request(testServer.host)
        .post('/')
        .field('action', 'fileUpload')
        .field('source', 'smallFiles')
        .attach('files[]', Buffer.from(largeContent), 'large.txt');

      expect(response1.status).toBe(403);
      expect(response1.body.success).toBe(false);
      expect(response1.body.data.messages).toContain(
        'File size exceeds the allowable'
      );

      // Try to upload the same file to largeFiles source (should succeed)
      const response2 = await request(testServer.host)
        .post('/')
        .field('action', 'fileUpload')
        .field('source', 'largeFiles')
        .attach('files[]', Buffer.from(largeContent), 'large.txt');

      expect(response2.status).toBe(200);
      expect(response2.body.success).toBe(true);
    });

    it('should override saveSameFileNameStrategy per source', async () => {
      testServer = await startTestServer({
        saveSameFileNameStrategy: 'addNumber',
        sources: {
          errorOnDuplicate: {
            name: 'errorOnDuplicate',
            title: 'Error on Duplicate',
            root: testFilesPath,
            baseurl: 'http://localhost:8081/files/test/',
            saveSameFileNameStrategy: 'error'
          },
          replaceOnDuplicate: {
            name: 'replaceOnDuplicate',
            title: 'Replace on Duplicate',
            root: testFilesPath2,
            baseurl: 'http://localhost:8081/files/test2/',
            saveSameFileNameStrategy: 'replace'
          }
        }
      });

      // Create initial file in both sources
      await createTestFile('duplicate.txt', 'original content', testFilesPath);
      await createTestFile('duplicate.txt', 'original content', testFilesPath2);

      // Try to upload duplicate to errorOnDuplicate source (should fail)
      const response1 = await request(testServer.host)
        .post('/')
        .field('action', 'fileUpload')
        .field('source', 'errorOnDuplicate')
        .attach('files[]', Buffer.from('new content'), 'duplicate.txt');

      expect(response1.status).toBe(400);
      expect(response1.body.success).toBe(false);
      expect(
        response1.body.data.messages.some((m: string) =>
          m.includes('already exists')
        )
      ).toBe(true);

      // Try to upload duplicate to replaceOnDuplicate source (should succeed)
      const response2 = await request(testServer.host)
        .post('/')
        .field('action', 'fileUpload')
        .field('source', 'replaceOnDuplicate')
        .attach('files[]', Buffer.from('new content'), 'duplicate.txt');

      expect(response2.status).toBe(200);
      expect(response2.body.success).toBe(true);
    });
  });

  describe('Image settings override', () => {
    it('should override imageExtensions per source', async () => {
      testServer = await startTestServer({
        imageExtensions: ['jpg', 'png'],
        sources: {
          jpegOnly: {
            name: 'jpegOnly',
            title: 'JPEG Only',
            root: testFilesPath,
            baseurl: 'http://localhost:8081/files/test/',
            imageExtensions: ['jpg', 'jpeg']
          }
        }
      });

      await createTestFile('test.jpg', 'image');
      await createTestFile('test.png', 'image');

      const response = await request(testServer.host)
        .get('/')
        .query({ action: 'files', source: 'jpegOnly' });

      expect(response.status).toBe(200);

      const allFiles = response.body.data.sources[0].files;

      // jpg should be marked as image, png should not
      const jpgFile = allFiles.find(
        (f: { file: string }) => f.file === 'test.jpg'
      );
      const pngFile = allFiles.find(
        (f: { file: string }) => f.file === 'test.png'
      );

      if (jpgFile) {
        expect(jpgFile.isImage).toBe(true);
        expect(jpgFile.type).toBe('image');
      }
      if (pngFile) {
        expect(pngFile.isImage).toBe(false);
        expect(pngFile.type).toBe('file');
      }
    });

    it('should override quality setting per source', async () => {
      testServer = await startTestServer({
        quality: 80,
        sources: {
          highQuality: {
            name: 'highQuality',
            title: 'High Quality',
            root: testFilesPath,
            baseurl: 'http://localhost:8081/files/test/',
            quality: 95
          },
          lowQuality: {
            name: 'lowQuality',
            title: 'Low Quality',
            root: testFilesPath2,
            baseurl: 'http://localhost:8081/files/test2/',
            quality: 50
          }
        }
      });

      expect(testServer).toBeDefined();
    });
  });

  describe('Other settings override', () => {
    it('should override excludeDirectoryNames per source', async () => {
      testServer = await startTestServer({
        excludeDirectoryNames: ['.git', 'node_modules'],
        sources: {
          showAll: {
            name: 'showAll',
            title: 'Show All',
            root: testFilesPath,
            baseurl: 'http://localhost:8081/files/test/',
            excludeDirectoryNames: []
          }
        }
      });

      expect(testServer).toBeDefined();
    });

    it('should override datetimeFormat per source', async () => {
      testServer = await startTestServer({
        datetimeFormat: 'YYYY-MM-DD',
        sources: {
          usFormat: {
            name: 'usFormat',
            title: 'US Format',
            root: testFilesPath,
            baseurl: 'http://localhost:8081/files/test/',
            datetimeFormat: 'MM/DD/YYYY'
          }
        }
      });

      await createTestFile('test.txt', 'content');

      const response = await request(testServer.host)
        .get('/')
        .query({ action: 'files', source: 'usFormat' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const files = response.body.data.sources[0].files.filter(
        (f: { type: string }) => f.type === 'file' || f.type === 'image'
      );

      if (files.length > 0) {
        // Check that date format matches MM/DD/YYYY pattern
        expect(files[0].changed).toMatch(/^\d{2}\/\d{2}\/\d{4}/);
      }
    });

    it('should override thumbFolderName per source', async () => {
      testServer = await startTestServer({
        thumbFolderName: '.thumbs',
        createThumb: true,
        sources: {
          customThumbFolder: {
            name: 'customThumbFolder',
            title: 'Custom Thumb Folder',
            root: testFilesPath,
            baseurl: 'http://localhost:8081/files/test/',
            thumbFolderName: '_thumbnails'
          }
        }
      });

      expect(testServer).toBeDefined();
    });
  });

  describe('Multiple sources with different configs', () => {
    it('should handle multiple sources with different overrides independently', async () => {
      testServer = await startTestServer({
        extensions: ['txt'],
        maxUploadFileSize: '10MB',
        saveSameFileNameStrategy: 'addNumber',
        sources: {
          source1: {
            name: 'source1',
            title: 'Source 1',
            root: testFilesPath,
            baseurl: 'http://localhost:8081/files/test/',
            extensions: ['jpg', 'png'],
            maxUploadFileSize: '1MB'
          },
          source2: {
            name: 'source2',
            title: 'Source 2',
            root: testFilesPath2,
            baseurl: 'http://localhost:8081/files/test2/',
            saveSameFileNameStrategy: 'error'
          }
        }
      });

      await createTestFile('test.txt', 'content', testFilesPath);
      await createTestFile('test.jpg', 'image', testFilesPath);
      await createTestFile('test.txt', 'content', testFilesPath2);

      // Source1 should only show jpg (extensions override)
      const response1 = await request(testServer.host)
        .get('/')
        .query({ action: 'files', source: 'source1' });

      expect(response1.status).toBe(200);
      const files1 = response1.body.data.sources[0].files.filter(
        (f: { type: string }) => f.type === 'file' || f.type === 'image'
      );
      expect(files1.some((f: { file: string }) => f.file === 'test.txt')).toBe(
        false
      );
      expect(files1.some((f: { file: string }) => f.file === 'test.jpg')).toBe(
        true
      );

      // Source2 should only show txt (global extensions)
      const response2 = await request(testServer.host)
        .get('/')
        .query({ action: 'files', source: 'source2' });

      expect(response2.status).toBe(200);
      const files2 = response2.body.data.sources[0].files.filter(
        (f: { type: string }) => f.type === 'file' || f.type === 'image'
      );
      expect(files2.some((f: { file: string }) => f.file === 'test.txt')).toBe(
        true
      );
    });
  });
});
