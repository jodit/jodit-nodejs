import request from 'supertest';
import {
  startTestServer,
  stopTestServer,
  createTestFile,
  type TestServer
} from '../test-server';
import type { AccessControlRule } from '../../types';

describe('Async Access Control', () => {
  let testServer: TestServer | null = null;

  afterEach(async () => {
    if (testServer) {
      await stopTestServer(testServer);
      testServer = null;
    }
  });

  it('should support accessControl as async function', async () => {
    // Simulate loading ACL from database/API
    const loadAccessControlFromDB = async (): Promise<AccessControlRule[]> => {
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 10));
      return [
        {
          role: 'guest',
          FILES: false
        }
      ];
    };

    testServer = await startTestServer({
      accessControl: loadAccessControlFromDB,
      defaultRole: 'guest'
    });

    await createTestFile('test.txt', 'content');

    const response = await request(testServer!.host)
      .get('/')
      .query({ action: 'files', source: 'test' });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.data.messages).toContain('Access denied');
  });

  it('should support accessControl as sync function', async () => {
    const getAccessControl = async (): Promise<AccessControlRule[]> => {
      return [
        {
          role: 'guest',
          FILES: true
        }
      ];
    };

    testServer = await startTestServer({
      accessControl: getAccessControl,
      defaultRole: 'guest'
    });

    await createTestFile('test.txt', 'content');

    const response = await request(testServer!.host)
      .get('/')
      .query({ action: 'files', source: 'test' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
