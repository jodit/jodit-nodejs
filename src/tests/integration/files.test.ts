import type * as http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { startTestServer, stopTestServer } from '../test-server';
import { createApp } from '../../app';

describe('Files API', () => {
  let server: http.Server;
  const testFilesPath = path.join(__dirname, '../../../files/test');
  const app = createApp();

  beforeAll(async () => {
    // Create test directory structure
    await fs.mkdir(testFilesPath, { recursive: true });
    await fs.writeFile(path.join(testFilesPath, 'test.txt'), 'test content');
    await fs.writeFile(path.join(testFilesPath, 'image.png'), 'fake image');
    await fs.mkdir(path.join(testFilesPath, 'subfolder'), { recursive: true });

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

  describe('GET /?action=files', () => {
    it('should return files list from test source', async () => {
      const response = await request(app)
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
      const response = await request(app)
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
      const response = await request(app)
        .get('/')
        .query({ action: 'files', source: 'test', mods: 'withFolders' });

      expect(response.status).toBe(200);
      const source = response.body.data.sources[0];

      // Should include the subfolder
      const folderItems = source?.files.filter(
        (f: { type: string }) => f.type === 'folder'
      );
      expect(folderItems.length).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent source', async () => {
      const response = await request(app)
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

    it('should return 400 when action parameter is missing', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        data: {
          code: 400,
          messages: expect.arrayContaining([
            expect.stringContaining('Action parameter is required')
          ])
        }
      });
    });

    it('should apply custom config from query parameter in debug mode', async () => {
      const customConfig = {
        sources: {
          custom: {
            title: 'Custom Source',
            root: testFilesPath,
            baseurl: 'http://localhost:3000/custom/'
          }
        }
      };

      const response = await request(app)
        .get('/')
        .query({
          action: 'files',
          source: 'custom',
          custom_config: JSON.stringify(customConfig)
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          code: 220,
          sources: expect.arrayContaining([
            expect.objectContaining({
              name: 'custom',
              title: 'Custom Source'
            })
          ])
        }
      });
    });

    it('should NOT apply custom config when debug is false', async () => {
      const appWithoutDebug = createApp({ debug: false });
      const customConfig = {
        sources: {
          custom: {
            title: 'Custom Source',
            root: testFilesPath,
            baseurl: 'http://localhost:3000/custom/'
          }
        }
      };

      const response = await request(appWithoutDebug)
        .get('/')
        .query({
          action: 'files',
          source: 'custom',
          custom_config: JSON.stringify(customConfig)
        });

      // Should return 404 because custom source was not applied
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

    it('should reject invalid custom config with validation errors', async () => {
      const invalidConfig = {
        sources: {
          invalid: {
            title: 'Invalid Source',
            root: testFilesPath,
            baseurl: 'not-a-valid-url' // Invalid URL
          }
        }
      };

      const response = await request(app)
        .get('/')
        .query({
          action: 'files',
          custom_config: JSON.stringify(invalidConfig)
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        data: {
          code: 400,
          messages: expect.arrayContaining([expect.stringContaining('baseurl')])
        }
      });
    });
  });

  describe('Health check', () => {
    it('should respond with 200 OK on /ping', async () => {
      const response = await request(app)
        .get('/ping')
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true
      });
    });
  });
});
