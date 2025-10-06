import path from 'path';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../../app';
import { createTestApp, cleanupTestFiles, createTestFile } from '../test-server';

describe('Access Control', () => {
  let app: Application;
  const testFilesPath = path.join(__dirname, '../../../files/test');

  beforeEach(async () => {
    await cleanupTestFiles();
  });

  afterEach(async () => {
    await cleanupTestFiles();
  });

  it('should allow access when no access control rules defined', async () => {
    app = createTestApp();
    await createTestFile('test.txt', 'test content');

    const response = await request(app)
      .get('/')
      .query({ action: 'files', source: 'test' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should deny access when role does not have permission', async () => {
    app = createApp({
      sources: {
        test: {
          title: 'Test Files',
          root: testFilesPath,
          baseurl: 'http://localhost:3000/files/test/'
        }
      },
      accessControl: [
        {
          role: 'guest',
          FILES: false
        }
      ],
      defaultRole: 'guest'
    });

    const response = await request(app)
      .get('/')
      .query({ action: 'files', source: 'test' });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.data.code).toBe(403);
    expect(response.body.data.messages).toContain('Access denied');
  });

  it('should allow access when role has permission', async () => {
    app = createApp({
      sources: {
        test: {
          title: 'Test Files',
          root: testFilesPath,
          baseurl: 'http://localhost:3000/files/test/'
        }
      },
      accessControl: [
        {
          role: 'admin',
          FILES: true
        }
      ],
      roleSessionVar: 'role',
      defaultRole: 'admin'
    });

    const response = await request(app)
      .get('/')
      .query({ action: 'files', source: 'test' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should check path-based permissions', async () => {
    app = createApp({
      sources: {
        test: {
          title: 'Test Files',
          root: testFilesPath,
          baseurl: 'http://localhost:3000/files/test/'
        }
      },
      accessControl: [
        {
          role: 'guest',
          FILES: true
        },
        {
          role: 'guest',
          path: '/private',
          FILES: false
        }
      ],
      defaultRole: 'guest'
    });

    // Should allow access to root path (doesn't match /private)
    const publicResponse = await request(app)
      .get('/')
      .query({ action: 'files', source: 'test', path: '/' });

    expect(publicResponse.status).toBe(200);

    // Should deny access to /private path
    const privateResponse = await request(app)
      .get('/')
      .query({ action: 'files', source: 'test', path: '/private' });

    expect(privateResponse.status).toBe(403);
    expect(privateResponse.body.data.messages).toContain('Access denied');
  });

  it('should check extension-based permissions', async () => {
    app = createApp({
      sources: {
        test: {
          title: 'Test Files',
          root: testFilesPath,
          baseurl: 'http://localhost:3000/files/test/'
        }
      },
      accessControl: [
        {
          role: 'guest',
          FILE_REMOVE: true
        },
        {
          role: 'guest',
          extensions: ['jpg', 'png'],
          FILE_REMOVE: false
        }
      ],
      defaultRole: 'guest'
    });

    await createTestFile('test.txt', 'test');
    await createTestFile('test.jpg', 'image');

    // Should allow removing txt file
    const txtResponse = await request(app)
      .get('/')
      .query({ action: 'fileRemove', source: 'test', name: 'test.txt' });

    expect(txtResponse.status).toBe(200);

    // Should deny removing jpg file
    const jpgResponse = await request(app)
      .get('/')
      .query({ action: 'fileRemove', source: 'test', name: 'test.jpg' });

    expect(jpgResponse.status).toBe(403);
    expect(jpgResponse.body.data.messages).toContain('Access denied');
  });

  it('should use wildcard role to match all roles', async () => {
    app = createApp({
      sources: {
        test: {
          title: 'Test Files',
          root: testFilesPath,
          baseurl: 'http://localhost:3000/files/test/'
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

    const response = await request(app)
      .get('/')
      .query({ action: 'fileUpload', source: 'test' });

    expect(response.status).toBe(403);
  });
});
