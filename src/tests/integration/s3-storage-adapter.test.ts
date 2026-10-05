import path from 'node:path';
import fs from 'node:fs/promises';
import { Readable } from 'node:stream';
import { jest } from '@jest/globals';
import request from 'supertest';
import { startTestServer, stopTestServer, TestServer } from '../test-server';
import { S3StorageAdapter } from '../../storage/s3';
import {
  isDockerAvailable,
  listKeys,
  objectExists,
  putObject,
  startMinio,
  isMinioImageAvailable,
  type MinioFixture
} from '../helpers/minio';

const BUCKET = 'jodit-test';
const PREFIX = 'site-a';
const JPEG_FIXTURE = path.join(
  process.cwd(),
  'files/pexels-yuri-manei-2337448.jpg'
);

const describeWithDocker =
  isDockerAvailable() && isMinioImageAvailable() ? describe : describe.skip;

jest.setTimeout(180_000);

describeWithDocker('S3 storage adapter (MinIO)', () => {
  let minio: MinioFixture;
  let adapter: S3StorageAdapter;
  let testServer: TestServer;
  let baseurl: string;

  const fileNames = async (dir = '/'): Promise<string[]> => {
    const response = await request(testServer.host)
      .get('/')
      .query({
        action: 'files',
        source: 's3',
        path: dir,
        mods: { withFolders: true }
      });

    expect(response.status).toBe(200);
    return response.body.data.sources[0].files.map(
      (f: { name: string }) => f.name
    );
  };

  beforeAll(async () => {
    minio = await startMinio(BUCKET);
    baseurl = `${minio.endpoint}/${BUCKET}/${PREFIX}/`;

    adapter = new S3StorageAdapter({
      bucket: BUCKET,
      endpoint: minio.endpoint,
      forcePathStyle: true,
      prefix: PREFIX,
      credentials: { accessKeyId: 'minioadmin', secretAccessKey: 'minioadmin' }
    });

    await adapter.write('hello.txt', Readable.from('Hello S3'), {});
    await adapter.write('sub/nested.txt', Readable.from('Nested'), {});
    await adapter.createDirectory('empty', {});
    // An object outside the prefix must stay invisible to the source
    await putObject(minio.client, BUCKET, 'other/secret.txt', 'top secret');

    testServer = await startTestServer({
      sources: {
        s3: {
          name: 's3',
          title: 'S3 bucket',
          baseurl,
          storageAdapter: 's3',
          s3: {
            bucket: BUCKET,
            endpoint: minio.endpoint,
            forcePathStyle: true,
            prefix: PREFIX,
            credentials: {
              accessKeyId: 'minioadmin',
              secretAccessKey: 'minioadmin'
            }
          }
        }
      }
    });
  });

  afterAll(async () => {
    if (testServer !== undefined) {
      await stopTestServer(testServer);
    }
    adapter?.client.destroy();
    await minio?.stop();
  });

  describe('adapter primitives', () => {
    it('reads back what it wrote', async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of await adapter.read('hello.txt')) {
        chunks.push(Buffer.from(chunk));
      }
      expect(Buffer.concat(chunks).toString()).toBe('Hello S3');
    });

    it('stats files and folders, explicit and implicit', async () => {
      expect((await adapter.stat('hello.txt')).isFile).toBe(true);
      expect((await adapter.stat('sub')).isDirectory).toBe(true);
      expect((await adapter.stat('empty')).isDirectory).toBe(true);
      expect((await adapter.stat('/')).isDirectory).toBe(true);
      await expect(adapter.stat('missing.txt')).rejects.toThrow(
        'Path not found'
      );
    });

    it('answers exists checks without throwing', async () => {
      expect(await adapter.fileExists('hello.txt')).toBe(true);
      expect(await adapter.fileExists('nope.txt')).toBe(false);
      expect(await adapter.directoryExists('sub')).toBe(true);
      expect(await adapter.directoryExists('nope')).toBe(false);
      expect(await adapter.fileExists('sub')).toBe(false);
    });

    it('lists only direct children in shallow mode', async () => {
      const entries = [];
      for await (const entry of adapter.list('', { deep: false })) {
        entries.push(entry);
      }
      const paths = entries.map(e => e.path).sort();
      expect(paths).toEqual(['empty', 'hello.txt', 'sub']);
      expect(entries.find(e => e.path === 'sub')?.isDirectory).toBe(true);
      expect(entries.find(e => e.path === 'hello.txt')?.isFile).toBe(true);
    });

    it('lists the whole tree in deep mode', async () => {
      const paths = [];
      for await (const entry of adapter.list('', { deep: true })) {
        paths.push(entry.path);
      }
      expect(paths.sort()).toEqual([
        'empty',
        'hello.txt',
        'sub',
        'sub/nested.txt'
      ]);
    });

    it('copies, moves and deletes files', async () => {
      await adapter.copyFile('hello.txt', 'copy.txt', {});
      expect(await adapter.fileExists('copy.txt')).toBe(true);
      await adapter.moveFile('copy.txt', 'sub/moved.txt', {});
      expect(await adapter.fileExists('copy.txt')).toBe(false);
      expect(await adapter.fileExists('sub/moved.txt')).toBe(true);
      await adapter.deleteFile('sub/moved.txt');
      expect(await adapter.fileExists('sub/moved.txt')).toBe(false);
    });

    it('moves whole folders', async () => {
      await adapter.write('tree/a.txt', Readable.from('a'), {});
      await adapter.write('tree/inner/b.txt', Readable.from('b'), {});
      await adapter.moveFile('tree', 'tree2', {});
      expect(await adapter.directoryExists('tree')).toBe(false);
      expect(await adapter.fileExists('tree2/a.txt')).toBe(true);
      expect(await adapter.fileExists('tree2/inner/b.txt')).toBe(true);
      await adapter.deleteDirectory('tree2');
      expect(await listKeys(minio.client, BUCKET, `${PREFIX}/tree`)).toEqual(
        []
      );
    });

    it('sets the content type from the extension', async () => {
      await adapter.write('page.html', Readable.from('<p>hi</p>'), {});
      expect(await adapter.mimeType('page.html')).toBe('text/html');
      await adapter.deleteFile('page.html');
    });
  });

  describe('connector actions on the S3 source', () => {
    it('lists files and folders and hides objects outside the prefix', async () => {
      const names = await fileNames();
      expect(names).toEqual(
        expect.arrayContaining(['hello.txt', 'sub', 'empty'])
      );
      expect(names).not.toContain('other');
      expect(names).not.toContain('secret.txt');
    });

    it('lists a subfolder', async () => {
      expect(await fileNames('/sub')).toContain('nested.txt');
    });

    it('lists folders with dots navigation', async () => {
      const response = await request(testServer.host)
        .get('/')
        .query({ action: 'folders', source: 's3', path: '/' });

      expect(response.status).toBe(200);
      const folders = response.body.data.sources[0].folders;
      expect(folders).toEqual(expect.arrayContaining(['.', 'sub', 'empty']));
    });

    it('creates a folder as a marker object', async () => {
      const response = await request(testServer.host)
        .post('/')
        .field('action', 'folderCreate')
        .field('source', 's3')
        .field('name', 'newdir');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(
        await objectExists(minio.client, BUCKET, `${PREFIX}/newdir/`)
      ).toBe(true);
      expect(await fileNames()).toContain('newdir');
    });

    it('uploads an image and stores its thumbnail next to it', async () => {
      const response = await request(testServer.host)
        .post('/')
        .field('action', 'fileUpload')
        .field('source', 's3')
        .attach('files', JPEG_FIXTURE);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.baseurl).toBe(baseurl);
      expect(response.body.data.files).toEqual([
        'pexels-yuri-manei-2337448.jpg'
      ]);
      expect(response.body.data.isImages).toEqual([true]);

      const listing = await request(testServer.host)
        .get('/')
        .query({ action: 'files', source: 's3', path: '/' });

      const image = listing.body.data.sources[0].files.find(
        (f: { name: string }) => f.name === 'pexels-yuri-manei-2337448.jpg'
      );
      expect(image.thumb).toBe('_thumbs/pexels-yuri-manei-2337448.jpg');

      const thumbKey = `${PREFIX}/_thumbs/pexels-yuri-manei-2337448.jpg`;
      expect(await objectExists(minio.client, BUCKET, thumbKey)).toBe(true);
      const original = await fs.stat(JPEG_FIXTURE);
      expect(
        await adapter.fileSize('_thumbs/pexels-yuri-manei-2337448.jpg')
      ).toBeLessThan(original.size);
    });

    it('resizes an image into a new object', async () => {
      const response = await request(testServer.host).get('/').query({
        action: 'imageResize',
        source: 's3',
        name: 'pexels-yuri-manei-2337448.jpg',
        newname: 'small.jpg',
        'box[w]': '64',
        'box[h]': '64'
      });

      expect(response.status).toBe(200);
      expect(response.body.data.newPath).toBe(`${baseurl}small.jpg`);
      expect(await adapter.fileExists('small.jpg')).toBe(true);
    });

    it('resolves a bucket URL back to a source path', async () => {
      const response = await request(testServer.host)
        .get('/')
        .query({
          action: 'getLocalFileByUrl',
          url: `${baseurl}pexels-yuri-manei-2337448.jpg`
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        path: '/',
        name: 'pexels-yuri-manei-2337448.jpg',
        source: 's3'
      });
    });

    it('downloads a file', async () => {
      const response = await request(testServer.host)
        .get('/')
        .query({ action: 'fileDownload', source: 's3', name: 'hello.txt' });

      expect(response.status).toBe(200);
      expect(response.body.toString()).toBe('Hello S3');
    });

    it('renames, moves and removes a file', async () => {
      const rename = await request(testServer.host)
        .post('/')
        .field('action', 'fileRename')
        .field('source', 's3')
        .field('name', 'hello.txt')
        .field('newname', 'renamed.txt');
      expect(rename.status).toBe(200);
      expect(await adapter.fileExists('hello.txt')).toBe(false);
      expect(await adapter.fileExists('renamed.txt')).toBe(true);

      const move = await request(testServer.host).get('/').query({
        action: 'fileMove',
        source: 's3',
        from: '/renamed.txt',
        path: '/sub'
      });
      expect(move.status).toBe(200);
      expect(await adapter.fileExists('sub/renamed.txt')).toBe(true);

      const remove = await request(testServer.host)
        .post('/')
        .field('action', 'fileRemove')
        .field('source', 's3')
        .field('path', '/sub')
        .field('name', 'renamed.txt');
      expect(remove.status).toBe(200);
      expect(await adapter.fileExists('sub/renamed.txt')).toBe(false);
    });

    it('removes a folder with everything under it', async () => {
      await adapter.write('gone/a.txt', Readable.from('a'), {});
      await adapter.write('gone/deep/b.txt', Readable.from('b'), {});

      const response = await request(testServer.host).get('/').query({
        action: 'folderRemove',
        source: 's3',
        name: 'gone'
      });

      expect(response.status).toBe(200);
      expect(await listKeys(minio.client, BUCKET, `${PREFIX}/gone`)).toEqual(
        []
      );
      expect(await fileNames()).not.toContain('gone');
    });

    it('clamps path traversal to the virtual root', async () => {
      // `/../../other` resolves to `/other` inside the source, which does
      // not exist under the prefix (the bucket-level `other/` must stay hidden)
      const missing = await request(testServer.host)
        .get('/')
        .query({ action: 'files', source: 's3', path: '/../../other' });
      expect(missing.status).toBe(404);

      const root = await request(testServer.host)
        .get('/')
        .query({
          action: 'files',
          source: 's3',
          path: '/../..',
          mods: { withFolders: true }
        });
      expect(root.status).toBe(200);
      expect(root.body.data.sources[0].path).toBe('/');
      const names = root.body.data.sources[0].files.map(
        (f: { name: string }) => f.name
      );
      expect(names).not.toContain('other');
    });
  });
});
