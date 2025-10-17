import express, { Router } from 'express';
import request from 'supertest';
import { createApp } from '../../app';
import { cleanupTestFiles, createTestFile } from '../test-server';
import path from 'path';

describe('Express Integration', () => {
  const testFilesPath = path.join(process.cwd(), './files/test');

  beforeAll(async () => {
    await createTestFile('integration-test.txt', 'test content');
  });

  afterAll(async () => {
    await cleanupTestFiles();
  });

  describe('Integration with existing Express app', () => {
    it('should work when integrated into existing Express app', async () => {
      // Create Express app with custom routes
      const myApp = express();

      // Add custom route before Jodit
      myApp.get('/health', (_req, res) => {
        res.json({ status: 'healthy' });
      });

      // Integrate Jodit Connector
      createApp(
        {
          sources: {
            test: {
              name: 'test',
              title: 'Test Files',
              root: testFilesPath,
              baseurl: 'http://localhost:8081/files/test/'
            }
          }
        },
        myApp
      );

      // Test custom route
      const healthResponse = await request(myApp).get('/health');
      expect(healthResponse.status).toBe(200);
      expect(healthResponse.body).toEqual({ status: 'healthy' });

      // Test Jodit route
      const filesResponse = await request(myApp)
        .get('/')
        .query({ action: 'files', source: 'test' });

      expect(filesResponse.status).toBe(200);
      expect(filesResponse.body.success).toBe(true);
      expect(filesResponse.body.data.sources).toHaveLength(1);
      expect(filesResponse.body.data.sources[0].name).toBe('test');
    });

    it('should preserve existing middleware in Express app', async () => {
      const myApp = express();

      // Add custom middleware
      const customHeaderMiddleware = (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
      ): void => {
        res.setHeader('X-Custom-Header', 'test-value');
        next();
      };

      myApp.use(customHeaderMiddleware);

      // Integrate Jodit Connector
      createApp(
        {
          sources: {
            test: {
              name: 'test',
              title: 'Test Files',
              root: testFilesPath,
              baseurl: 'http://localhost:8081/files/test/'
            }
          }
        },
        myApp
      );

      const response = await request(myApp)
        .get('/')
        .query({ action: 'files', source: 'test' });

      expect(response.status).toBe(200);
      expect(response.headers['x-custom-header']).toBe('test-value');
    });
  });

  describe('Integration with custom Router', () => {
    it('should work with custom router mounted at specific path', async () => {
      const myApp = express();
      const myRouter = Router();

      // Integrate Jodit Connector with custom router
      createApp(
        {
          sources: {
            test: {
              name: 'test',
              title: 'Test Files',
              root: testFilesPath,
              baseurl: 'http://localhost:8081/files/test/'
            }
          }
        },
        myApp,
        myRouter
      );

      // Mount router at /api/files prefix
      myApp.use('/api/files', myRouter);

      // Test Jodit routes with prefix
      const response = await request(myApp)
        .get('/api/files/')
        .query({ action: 'files', source: 'test' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.sources).toHaveLength(1);
    });

    it('should work with ping endpoint on custom router', async () => {
      const myApp = express();
      const myRouter = Router();

      createApp({}, myApp, myRouter);

      myApp.use('/jodit', myRouter);

      const response = await request(myApp).get('/jodit/ping');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    it('should support multiple Jodit instances with different routers', async () => {
      const myApp = express();

      // First Jodit instance for public files
      const publicRouter = Router();
      createApp(
        {
          sources: {
            public: {
              name: 'public',
              title: 'Public Files',
              root: testFilesPath,
              baseurl: 'http://localhost:8081/public/'
            }
          }
        },
        myApp,
        publicRouter
      );

      myApp.use('/public', publicRouter);

      // Second Jodit instance for private files
      const privateRouter = Router();
      createApp(
        {
          sources: {
            private: {
              name: 'private',
              title: 'Private Files',
              root: testFilesPath,
              baseurl: 'http://localhost:8081/private/'
            }
          },
          accessControl: [
            {
              role: 'guest',
              FILES: false
            }
          ],
          defaultRole: 'guest'
        },
        myApp,
        privateRouter
      );

      myApp.use('/private', privateRouter);

      // Test public endpoint (should work)
      const publicResponse = await request(myApp)
        .get('/public/')
        .query({ action: 'files', source: 'public' });

      expect(publicResponse.status).toBe(200);
      expect(publicResponse.body.success).toBe(true);

      // Test private endpoint (should be denied for guest)
      const privateResponse = await request(myApp)
        .get('/private/')
        .query({ action: 'files', source: 'private' });

      expect(privateResponse.status).toBe(403);
      expect(privateResponse.body.success).toBe(false);
      expect(privateResponse.body.data.messages).toContain('Access denied');
    });
  });

  describe('Standalone mode (backward compatibility)', () => {
    it('should work as standalone app without existing app/router', async () => {
      // This is the default usage - should still work
      const app = createApp({
        sources: {
          test: {
            name: 'test',
            title: 'Test Files',
            root: testFilesPath,
            baseurl: 'http://localhost:8081/files/test/'
          }
        }
      });

      const response = await request(app)
        .get('/')
        .query({ action: 'files', source: 'test' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should work with ping endpoint in standalone mode', async () => {
      const app = createApp();

      const response = await request(app).get('/ping');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });
  });
});
