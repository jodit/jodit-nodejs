import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import {
  startTestServer,
  stopTestServer,
  TestServer
} from '../../tests/test-server';

describe('Files API', () => {
  let testServer: TestServer | null = null;
  const testFilesPath = path.join(__dirname, '../../../files/test');

  beforeAll(async () => {
    testServer = await startTestServer();
    // Create test directory structure
    await fs.writeFile(path.join(testFilesPath, 'test.txt'), 'test content');
    await fs.writeFile(path.join(testFilesPath, 'image.png'), 'fake image');
    await fs.mkdir(path.join(testFilesPath, 'subfolder'), { recursive: true });

    // Create additional test files for sorting tests
    await fs.writeFile(path.join(testFilesPath, 'file-a.txt'), 'a');
    await fs.writeFile(path.join(testFilesPath, 'file-z.txt'), 'z');
    await fs.writeFile(path.join(testFilesPath, 'file-m.txt'), 'm');
    await new Promise(resolve => setTimeout(resolve, 100));
    await fs.writeFile(path.join(testFilesPath, 'newer.txt'), 'newer');
  });

  afterAll(async () => {
    await stopTestServer(testServer!);
  });

  describe('GET /?action=files', () => {
    it('should return files list from test source', async () => {
      const response = await request(testServer!.host)
        .get('/')
        .query({ action: 'files', source: 'test' })
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          code: 220,
          sources: expect.arrayContaining([
            expect.objectContaining({
              name: 'test',
              title: 'Test Files',
              files: expect.any(Array)
            })
          ])
        }
      });

      const source = response.body.data.sources[0];
      expect(source?.files.length).toBeGreaterThan(0);

      // Check that image.png is marked as image
      const imageFile = source?.files.find(
        (f: { name: string }) => f.name === 'image.png'
      );
      expect(imageFile?.isImage).toBe(true);

      // Check that test.txt is not marked as image
      const textFile = source?.files.find(
        (f: { name: string }) => f.name === 'test.txt'
      );
      expect(textFile?.isImage).toBe(false);
    });

    it('should return files without folders by default', async () => {
      const response = await request(testServer!.host)
        .get('/')
        .query({ action: 'files', source: 'test' });

      expect(response.status).toBe(200);
      const source = response.body.data.sources[0];

      // Should not include the subfolder
      const folderItems = source?.files.filter(
        (f: { type: string }) => f.type === 'folder'
      );
      expect(folderItems).toHaveLength(0);
    });

    it('should return files with folders when mods[withFolders]=true', async () => {
      const response = await request(testServer!.host)
        .get('/')
        .query({
          action: 'files',
          source: 'test',
          mods: { withFolders: true }
        });

      expect(response.status).toBe(200);
      const source = response.body.data.sources[0];

      // Should include the subfolder
      const folderItems = source?.files.filter(
        (f: { type: string }) => f.type === 'folder'
      );
      expect(folderItems.length).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent source', async () => {
      const response = await request(testServer!.host)
        .get('/')
        .query({ action: 'files', source: 'nonexistent' });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        data: {
          code: 404,
          messages: expect.arrayContaining([
            expect.stringContaining('not found')
          ])
        }
      });
    });

    it('should return 404 when action parameter is missing', async () => {
      const response = await request(testServer!.host).get('/');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        data: {
          code: 404,
          messages: expect.arrayContaining([
            expect.stringContaining('Action "default" not found')
          ])
        }
      });
    });
  });

  describe('Sorting and filtering', () => {
    it('should sort files by name ascending', async () => {
      const response = await request(testServer!.host)
        .post('/')
        .send({
          action: 'files',
          source: 'test',
          mods: {
            sortBy: 'name-asc'
          }
        });

      expect(response.status).toBe(200);
      const files = response.body.data.sources[0].files;

      // Check that files are sorted alphabetically
      for (let i = 1; i < files.length; i++) {
        expect(
          files[i].file.toLowerCase() >= files[i - 1].file.toLowerCase()
        ).toBe(true);
      }
    });

    it('should sort files by name descending', async () => {
      const response = await request(testServer!.host)
        .post('/')
        .send({
          action: 'files',
          source: 'test',
          mods: {
            sortBy: 'name-desc'
          }
        });

      expect(response.status).toBe(200);
      const files = response.body.data.sources[0].files;

      // Check that files are sorted reverse alphabetically
      for (let i = 1; i < files.length; i++) {
        expect(
          files[i].file.toLowerCase() <= files[i - 1].file.toLowerCase()
        ).toBe(true);
      }
    });

    it('should sort files by changed time ascending', async () => {
      const response = await request(testServer!.host)
        .post('/')
        .send({
          action: 'files',
          source: 'test',
          mods: {
            sortBy: 'changed-asc'
          }
        });

      expect(response.status).toBe(200);
      const files = response.body.data.sources[0].files;

      // Check that files are sorted by modification time
      for (let i = 1; i < files.length; i++) {
        expect(files[i].changed >= files[i - 1].changed).toBe(true);
      }
    });

    it('should sort files by changed time descending', async () => {
      const response = await request(testServer!.host)
        .post('/')
        .send({
          action: 'files',
          source: 'test',
          mods: {
            sortBy: 'changed-desc'
          }
        });

      expect(response.status).toBe(200);
      const files = response.body.data.sources[0].files;

      // Check that files are sorted by modification time descending
      for (let i = 1; i < files.length; i++) {
        expect(files[i].changed <= files[i - 1].changed).toBe(true);
      }
    });

    it('should filter only images', async () => {
      const response = await request(testServer!.host)
        .post('/')
        .send({
          action: 'files',
          source: 'test',
          mods: {
            onlyImages: true
          }
        });

      expect(response.status).toBe(200);
      const files = response.body.data.sources[0].files;

      // All returned files should be images
      files.forEach((file: { isImage: boolean }) => {
        expect(file.isImage).toBe(true);
      });
    });

    it('should apply limit to results', async () => {
      const response = await request(testServer!.host)
        .post('/')
        .send({
          action: 'files',
          source: 'test',
          mods: {
            limit: 2
          }
        });

      expect(response.status).toBe(200);
      const files = response.body.data.sources[0].files;
      expect(files.length).toBe(2);
    });

    it('should apply offset and limit', async () => {
      const allResponse = await request(testServer!.host)
        .post('/')
        .send({
          action: 'files',
          source: 'test',
          mods: {
            sortBy: 'name-asc'
          }
        });

      const offsetResponse = await request(testServer!.host)
        .post('/')
        .send({
          action: 'files',
          source: 'test',
          mods: {
            sortBy: 'name-asc',
            offset: 1,
            limit: 2
          }
        });

      expect(offsetResponse.status).toBe(200);
      const allFiles = allResponse.body.data.sources[0].files;
      const offsetFiles = offsetResponse.body.data.sources[0].files;

      expect(offsetFiles.length).toBe(2);
      expect(offsetFiles[0].file).toBe(allFiles[1].file);
      expect(offsetFiles[1].file).toBe(allFiles[2].file);
    });

    it('should combine sorting, filtering, and limiting', async () => {
      const response = await request(testServer!.host)
        .post('/')
        .send({
          action: 'files',
          source: 'test',
          mods: {
            sortBy: 'name-desc',
            onlyImages: true,
            limit: 1
          }
        });

      expect(response.status).toBe(200);
      const files = response.body.data.sources[0].files;

      expect(files.length).toBe(1);
      expect(files[0].isImage).toBe(true);
    });

    it('should place folders at top when foldersPosition=top', async () => {
      const response = await request(testServer!.host)
        .post('/')
        .send({
          action: 'files',
          source: 'test',
          mods: {
            withFolders: true,
            foldersPosition: 'top'
          }
        });

      expect(response.status).toBe(200);
      const files = response.body.data.sources[0].files;

      // First item should be a folder
      expect(files[0].type).toBe('folder');
    });

    it('should place folders at bottom when foldersPosition=bottom', async () => {
      const response = await request(testServer!.host)
        .post('/')
        .send({
          action: 'files',
          source: 'test',
          mods: {
            withFolders: true,
            foldersPosition: 'bottom'
          }
        });

      expect(response.status).toBe(200);
      const files = response.body.data.sources[0].files;

      // Last item should be a folder
      expect(files[files.length - 1].type).toBe('folder');
    });

    it('should get files from all sources when source param is omitted', async () => {
      const response = await request(testServer!.host)
        .get('/')
        .query({ action: 'files' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.sources).toBeDefined();
      expect(response.body.data.sources.length).toBeGreaterThan(0);

      // Should include the test source
      const testSource = response.body.data.sources.find(
        (s: { name: string }) => s.name === 'test'
      );
      expect(testSource).toBeDefined();
      expect(testSource.files).toBeDefined();
    });
  });

  describe('Invalid actions and edge cases', () => {
    it('should return 404 for unknown action', async () => {
      const response = await request(testServer!.host)
        .get('/')
        .query({ action: 'unknownAction' });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        data: {
          code: 404,
          messages: expect.arrayContaining([
            expect.stringContaining('not found')
          ])
        }
      });
    });

    it('should handle XSS attempt in action parameter', async () => {
      const response = await request(testServer!.host)
        .get('/')
        .query({ action: '<script>alert(1)</script>' });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        data: {
          code: 404
        }
      });
    });
  });

  describe('Health check', () => {
    it('should respond with 200 OK on /ping', async () => {
      const response = await request(testServer!.host)
        .get('/ping')
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true
      });
    });
  });
});
