import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import {
  startTestServer,
  stopTestServer,
  TestServer
} from '../test-server';

const testFilesPath = path.join(process.cwd(), './files/test');
const privateDir = path.join(testFilesPath, 'private');

/**
 * A rule hiding `/private` has to hold whichever way the client spells the
 * path. `files` and `folders` rely on this check alone, so a spelling that
 * slips past it lists a folder the configuration meant to hide.
 */
describe('Access rules hold for every spelling of the same path', () => {
  let testServer: TestServer | null = null;

  beforeAll(async () => {
    await fs.mkdir(privateDir, { recursive: true });
    await fs.writeFile(path.join(privateDir, 'secret.txt'), 'classified');

    testServer = await startTestServer({
      accessControl: [{ role: 'guest', path: '/private', FILES: false }],
      defaultRole: 'guest'
    });
  });

  afterAll(async () => {
    await stopTestServer(testServer!);
    await fs.rm(privateDir, { recursive: true, force: true });
  });

  it.each([
    ['/private', 'the canonical spelling'],
    ['private', 'without the leading slash'],
    ['./private', 'relative'],
    ['/public/../private', 'through a parent segment'],
    ['//private', 'with a doubled slash'],
    ['/private/', 'with a trailing slash']
  ])('should deny files for %s (%s)', async requestPath => {
    const response = await request(testServer!.host)
      .post('/')
      .send({ action: 'files', source: 'test', path: requestPath });

    expect(response.status).toBe(403);
    expect(JSON.stringify(response.body)).not.toContain('secret.txt');
  });

  it('should still allow a folder the rule does not cover', async () => {
    const response = await request(testServer!.host)
      .post('/')
      .send({ action: 'files', source: 'test', path: '/' });

    expect(response.status).toBe(200);
  });
});
