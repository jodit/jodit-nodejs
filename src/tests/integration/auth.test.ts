import path from 'path';
import request from 'supertest';
import type { Request } from 'express';
import { start, stop, type AuthCallback } from '../../index';
import { cleanupTestFiles, createTestFile } from '../test-server';

describe('Authentication Middleware', () => {
  const testFilesPath = path.join(process.cwd(), './files/test');

  beforeEach(async () => {
    await cleanupTestFiles();
  });

  afterEach(async () => {
    await stop();
    await cleanupTestFiles();
  });

  it('should use default role when no checkAuthentication provided', async () => {
    const server = await start({
      port: 3001,
      config: {
        sources: {
          test: {
            title: 'Test Files',
            root: testFilesPath,
            baseurl: 'http://localhost:3001/files/test/'
          }
        },
        defaultRole: 'guest'
      }
    });

    await createTestFile('test.txt', 'test content');

    const response = await request(server)
      .get('/')
      .query({ action: 'files', source: 'test' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should call checkAuthentication callback and set user role', async () => {
    const mockCheckAuth: AuthCallback = (req: Request) => {
      // Check for custom header
      const userRole = req.headers['x-user-role'] as string;
      return userRole ?? 'guest';
    };

    const server = await start({
      port: 3002,
      config: {
        sources: {
          test: {
            title: 'Test Files',
            root: testFilesPath,
            baseurl: 'http://localhost:3002/files/test/'
          }
        },
        accessControl: [
          {
            role: 'admin',
            FILES: true
          },
          {
            role: 'guest',
            FILES: false
          }
        ],
        defaultRole: 'guest'
      },
      checkAuthentication: mockCheckAuth
    });

    await createTestFile('test.txt', 'test content');

    // Request with admin role
    const adminResponse = await request(server)
      .get('/')
      .set('x-user-role', 'admin')
      .query({ action: 'files', source: 'test' });

    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.success).toBe(true);

    // Request with guest role (should be denied)
    const guestResponse = await request(server)
      .get('/')
      .set('x-user-role', 'guest')
      .query({ action: 'files', source: 'test' });

    expect(guestResponse.status).toBe(403);
    expect(guestResponse.body.success).toBe(false);
  });

  it('should support async checkAuthentication callback', async () => {
    const mockCheckAuth: AuthCallback = async (req: Request) => {
      // Simulate async operation (e.g., database lookup)
      await new Promise(resolve => setTimeout(resolve, 10));
      const userRole = req.headers['x-user-role'] as string;
      return userRole ?? 'guest';
    };

    const server = await start({
      port: 3003,
      config: {
        sources: {
          test: {
            title: 'Test Files',
            root: testFilesPath,
            baseurl: 'http://localhost:3003/files/test/'
          }
        },
        accessControl: [
          {
            role: 'admin',
            FILES: true
          },
          {
            role: 'guest',
            FILES: false
          }
        ],
        defaultRole: 'guest'
      },
      checkAuthentication: mockCheckAuth
    });

    await createTestFile('test.txt', 'test content');

    const response = await request(server)
      .get('/')
      .set('x-user-role', 'admin')
      .query({ action: 'files', source: 'test' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should fail request when checkAuthentication throws error', async () => {
    const mockCheckAuth: AuthCallback = () => {
      throw new Error('Unauthorized');
    };

    const server = await start({
      port: 3004,
      config: {
        sources: {
          test: {
            title: 'Test Files',
            root: testFilesPath,
            baseurl: 'http://localhost:3004/files/test/'
          }
        },
        defaultRole: 'guest'
      },
      checkAuthentication: mockCheckAuth
    });

    const response = await request(server)
      .get('/')
      .query({ action: 'files', source: 'test' });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain('Unauthorized');
  });

  it('should fail request when async checkAuthentication rejects', async () => {
    const mockCheckAuth: AuthCallback = async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      throw new Error('Authentication failed');
    };

    const server = await start({
      port: 3005,
      config: {
        sources: {
          test: {
            title: 'Test Files',
            root: testFilesPath,
            baseurl: 'http://localhost:3005/files/test/'
          }
        },
        defaultRole: 'guest'
      },
      checkAuthentication: mockCheckAuth
    });

    const response = await request(server)
      .get('/')
      .query({ action: 'files', source: 'test' });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain('Authentication failed');
  });
});
