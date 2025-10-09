import request from 'supertest';
import {
  startTestServer,
  stopTestServer,
  TestServer
} from '../../tests/test-server';

describe('Permissions (GET /?action=permissions)', () => {
  let testServer: TestServer | null = null;

  beforeAll(async () => {
    testServer = await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer(testServer!);
  });

  it('should return permissions for valid source', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'permissions',
      source: 'test'
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        code: 220,
        permissions: {
          allowFiles: true,
          allowFileMove: true,
          allowFileUpload: true,
          allowFileUploadRemote: true,
          allowFileRemove: true,
          allowFileRename: true,
          allowFolders: true,
          allowFolderMove: true,
          allowFolderCreate: true,
          allowFolderRemove: true,
          allowFolderRename: true,
          allowImageResize: true,
          allowImageCrop: true
        }
      }
    });
  });

  it('should return permissions when source is specified', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'permissions',
      source: 'test'
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.permissions).toBeDefined();
  });

  it('should return 404 for non-existent source', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'permissions',
      source: 'non-existent-source'
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain('Source not found');
  });

  it('should handle path parameter', async () => {
    const response = await request(testServer!.host).get('/').query({
      action: 'permissions',
      source: 'test',
      path: '/subfolder'
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
