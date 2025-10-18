import path from 'path';
import request from 'supertest';
import { start, stop } from '../../index';
import { cleanupTestFiles, createTestFile } from '../test-server';

describe('onlyPOST Configuration', () => {
  const testFilesPath = path.join(process.cwd(), './files/test');

  beforeEach(async () => {
    await cleanupTestFiles();
  });

  afterEach(async () => {
    await stop();
    await cleanupTestFiles();
  });

  describe('when onlyPOST is false (default)', () => {
    it('should allow GET requests', async () => {
      const server = await start({
        port: 3001,
        config: {
          onlyPOST: false,
          sources: {
            test: {
              name: 'test',
              title: 'Test Files',
              root: testFilesPath,
              baseurl: 'http://localhost:3001/files/test/'
            }
          }
        }
      });

      await createTestFile('test.txt', 'test content');

      const response = await request(server)
        .get('/')
        .query({ action: 'files', source: 'test' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should allow POST requests', async () => {
      const server = await start({
        port: 3001,
        config: {
          onlyPOST: false,
          sources: {
            test: {
              name: 'test',
              title: 'Test Files',
              root: testFilesPath,
              baseurl: 'http://localhost:3001/files/test/'
            }
          }
        }
      });

      await createTestFile('test.txt', 'test content');

      const response = await request(server)
        .post('/')
        .send({ action: 'files', source: 'test' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should allow GET requests to /ping endpoint', async () => {
      const server = await start({
        port: 3001,
        config: {
          onlyPOST: false
        }
      });

      const response = await request(server).get('/ping');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('when onlyPOST is true', () => {
    it('should block GET requests with 405 Method Not Allowed', async () => {
      const server = await start({
        port: 3001,
        config: {
          onlyPOST: true,
          sources: {
            test: {
              name: 'test',
              title: 'Test Files',
              root: testFilesPath,
              baseurl: 'http://localhost:3001/files/test/'
            }
          }
        }
      });

      await createTestFile('test.txt', 'test content');

      const response = await request(server)
        .get('/')
        .query({ action: 'files', source: 'test' });

      expect(response.status).toBe(405);
      expect(response.body.success).toBe(false);
      expect(response.body.data.code).toBe(405);
      expect(response.body.data.messages).toContain(
        'GET requests are disabled. Use POST instead.'
      );
    });

    it('should block GET requests to /ping endpoint', async () => {
      const server = await start({
        port: 3001,
        config: {
          onlyPOST: true
        }
      });

      const response = await request(server).get('/ping');

      expect(response.status).toBe(405);
      expect(response.body.success).toBe(false);
      expect(response.body.data.messages).toContain(
        'GET requests are disabled. Use POST instead.'
      );
    });

    it('should allow POST requests', async () => {
      const server = await start({
        port: 3001,
        config: {
          onlyPOST: true,
          sources: {
            test: {
              name: 'test',
              title: 'Test Files',
              root: testFilesPath,
              baseurl: 'http://localhost:3001/files/test/'
            }
          }
        }
      });

      await createTestFile('test.txt', 'test content');

      const response = await request(server)
        .post('/')
        .send({ action: 'files', source: 'test' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should allow POST requests to action endpoints', async () => {
      const server = await start({
        port: 3001,
        config: {
          onlyPOST: true,
          sources: {
            test: {
              name: 'test',
              title: 'Test Files',
              root: testFilesPath,
              baseurl: 'http://localhost:3001/files/test/'
            }
          }
        }
      });

      await createTestFile('test.txt', 'test content');

      const response = await request(server)
        .post('/files')
        .send({ source: 'test' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should block GET requests with action parameter', async () => {
      const server = await start({
        port: 3001,
        config: {
          onlyPOST: true,
          sources: {
            test: {
              name: 'test',
              title: 'Test Files',
              root: testFilesPath,
              baseurl: 'http://localhost:3001/files/test/'
            }
          }
        }
      });

      const response = await request(server)
        .get('/files')
        .query({ source: 'test' });

      expect(response.status).toBe(405);
      expect(response.body.success).toBe(false);
    });
  });
});
