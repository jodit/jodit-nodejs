import { Readable } from 'node:stream';
import request from 'supertest';
import { startTestServer, stopTestServer, TestServer } from '../test-server';
import { InMemoryStorageAdapter } from '../helpers/in-memory-storage-adapter';
import type { ResolvedSources, SourceConfig } from '../../types';

/**
 * Multi-tenant mode: sources are resolved per request from a header.
 * Each tenant gets its own in-memory adapter, so isolation is observable.
 */
describe('Dynamic sources (resolveSources)', () => {
  let testServer: TestServer;
  const tenantA = new InMemoryStorageAdapter();
  const tenantB = new InMemoryStorageAdapter();
  const resolverCalls: string[] = [];
  let seenRoleForTenant: string | undefined;

  const tenantSource = (
    name: string,
    adapter: InMemoryStorageAdapter
  ): Record<string, SourceConfig> => ({
    files: {
      name: 'files',
      title: `Tenant ${name}`,
      baseurl: `http://cdn.example.com/${name}/`,
      storageAdapter: adapter
    }
  });

  beforeAll(async () => {
    await tenantA.write('a.txt', Readable.from('tenant a'), {});
    await tenantB.write('b.txt', Readable.from('tenant b'), {});

    testServer = await startTestServer(
      {
        resolveSources: (req): ResolvedSources | null => {
          const tenant = req.header('x-tenant');
          resolverCalls.push(tenant ?? '');

          if (tenant === 'a') {
            return { id: 'tenant-a', sources: tenantSource('a', tenantA) };
          }
          if (tenant === 'b') {
            return { id: 'tenant-b', sources: tenantSource('b', tenantB) };
          }

          // Unknown tenant: fall back to the static sources
          return null;
        }
      },
      req => {
        seenRoleForTenant = req.header('x-tenant');
        return req.header('x-tenant') === 'b' ? 'reader' : 'guest';
      }
    );
  });

  afterAll(async () => {
    await stopTestServer(testServer);
  });

  const listNames = async (tenant?: string): Promise<string[]> => {
    let req = request(testServer.host)
      .get('/')
      .query({
        action: 'files',
        source: tenant === undefined ? 'test' : 'files'
      });
    if (tenant !== undefined) {
      req = req.set('x-tenant', tenant);
    }
    const response = await req;
    expect(response.status).toBe(200);
    return response.body.data.sources[0].files.map(
      (f: { name: string }) => f.name
    );
  };

  it('answers /ping without resolving a tenant or a role', async () => {
    const response = await request(testServer.host).get('/ping');
    expect(response.status).toBe(200);
    expect(resolverCalls).not.toContain('ping');
  });

  it('serves each tenant its own storage', async () => {
    expect(await listNames('a')).toEqual(['a.txt']);
    expect(await listNames('b')).toEqual(['b.txt']);
  });

  it('uses the tenant baseurl in responses', async () => {
    const response = await request(testServer.host)
      .get('/')
      .set('x-tenant', 'b')
      .query({ action: 'files', source: 'files' });

    expect(response.body.data.sources[0].baseurl).toBe(
      'http://cdn.example.com/b/'
    );
  });

  it('writes land in the right tenant', async () => {
    const response = await request(testServer.host)
      .post('/')
      .set('x-tenant', 'a')
      .field('action', 'fileUpload')
      .field('source', 'files')
      .attach('files', Buffer.from('from a'), 'upload.txt');

    expect(response.status).toBe(200);
    expect(await tenantA.fileExists('upload.txt')).toBe(true);
    expect(await tenantB.fileExists('upload.txt')).toBe(false);
  });

  it('falls back to static sources when the resolver returns null', async () => {
    const response = await request(testServer.host)
      .get('/')
      .query({ action: 'files' });

    expect(response.status).toBe(200);
    expect(response.body.data.sources[0].name).toBe('test');
  });

  it('does not expose tenant sources without the tenant header', async () => {
    const response = await request(testServer.host)
      .get('/')
      .query({ action: 'files', source: 'files' });

    expect(response.status).toBe(404);
  });

  it('runs the resolver on every request but builds sources once per id', async () => {
    const before = resolverCalls.length;
    await listNames('a');
    await listNames('a');
    expect(resolverCalls.length).toBe(before + 2);
    // Same adapter instance keeps serving: the upload from the earlier test is still visible
    expect(await listNames('a')).toEqual(
      expect.arrayContaining(['a.txt', 'upload.txt'])
    );
  });

  it('keeps the request role from checkAuthentication alongside the sources', async () => {
    await listNames('b');
    expect(seenRoleForTenant).toBe('b');
  });
});
