import request from 'supertest';
import { startTestServer, stopTestServer, TestServer } from '../test-server';
import { Readable } from 'stream';
import { InMemoryStorageAdapter } from '../helpers/in-memory-storage-adapter';

describe('Custom Storage Adapter Integration', () => {
  let testServer: TestServer | null = null;
  const customAdapter = new InMemoryStorageAdapter();

  beforeAll(async () => {
    // Seed some initial data in the adapter
    await customAdapter.write('test.txt', Readable.from('Hello World'), {});
    await customAdapter.write('image.png', Readable.from('fake-png-data'), {});
    await customAdapter.createDirectory('subdir', {});
    await customAdapter.write(
      'subdir/nested.txt',
      Readable.from('Nested file'),
      {}
    );

    testServer = await startTestServer({
      sources: {
        memory: {
          name: 'memory',
          title: 'In-Memory Storage',
          root: process.cwd(), // Use real directory for path validation
          baseurl: 'http://localhost:8081/files/memory/',
          storageAdapter: customAdapter
        }
      }
    });
  });

  afterAll(async () => {
    await stopTestServer(testServer!);
  });

  describe('Files listing with custom adapter', () => {
    it('should list files from in-memory storage', async () => {
      const response = await request(testServer!.host)
        .get('/')
        .query({
          action: 'files',
          source: 'memory',
          mods: { withFolders: true }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.sources).toHaveLength(1);

      const source = response.body.data.sources[0];
      expect(source.name).toBe('memory');

      // Should contain our seeded files
      const fileNames = source.files.map((f: { name: string }) => f.name);

      expect(fileNames).toContain('test.txt');
      expect(fileNames).toContain('image.png');
      expect(fileNames).toContain('subdir');
    });

    it('should list files in subdirectory', async () => {
      const response = await request(testServer!.host)
        .get('/')
        .query({ action: 'files', source: 'memory', path: '/subdir' });

      expect(response.status).toBe(200);
      const source = response.body.data.sources[0];
      const fileNames = source.files.map((f: { name: string }) => f.name);
      expect(fileNames).toContain('nested.txt');
    });
  });

  describe('Folder operations with custom adapter', () => {
    it('should list folders from in-memory storage', async () => {
      const response = await request(testServer!.host)
        .get('/')
        .query({ action: 'folders', source: 'memory' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const folders = response.body.data.sources[0].folders;
      expect(folders).toContain('subdir');
    });

    it('should create a new folder in memory', async () => {
      const response = await request(testServer!.host)
        .post('/')
        .field('action', 'folderCreate')
        .field('source', 'memory')
        .field('name', 'newfolder');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify folder exists
      const exists = await customAdapter.directoryExists('newfolder');
      expect(exists).toBe(true);
    });

    it('should remove a folder from memory', async () => {
      // Create folder first
      await customAdapter.createDirectory('todelete', {});

      const response = await request(testServer!.host)
        .post('/')
        .field('action', 'folderRemove')
        .field('source', 'memory')
        .field('name', 'todelete');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify folder doesn't exist
      const exists = await customAdapter.directoryExists('todelete');
      expect(exists).toBe(false);
    });
  });

  describe('File operations with custom adapter', () => {
    it('should upload a file to in-memory storage', async () => {
      const response = await request(testServer!.host)
        .post('/')
        .field('action', 'fileUpload')
        .field('source', 'memory')
        .attach('files', Buffer.from('uploaded content'), 'uploaded.txt');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify file exists in memory
      const exists = await customAdapter.fileExists('uploaded.txt');
      expect(exists).toBe(true);

      // Verify content
      const content = await customAdapter.read('uploaded.txt');
      const chunks: Buffer[] = [];
      for await (const chunk of content) {
        chunks.push(Buffer.from(chunk));
      }
      const fileContent = Buffer.concat(chunks).toString();
      expect(fileContent).toBe('uploaded content');
    });

    it('should download a file from in-memory storage', async () => {
      const response = await request(testServer!.host).get('/').query({
        action: 'fileDownload',
        source: 'memory',
        name: 'test.txt'
      });

      expect(response.status).toBe(200);
      // Response body is a Buffer for binary data
      expect(response.body.toString()).toBe('Hello World');
    });

    it('should remove a file from in-memory storage', async () => {
      // Create a file to delete
      await customAdapter.write('toremove.txt', Readable.from('delete me'), {});

      const response = await request(testServer!.host)
        .post('/')
        .field('action', 'fileRemove')
        .field('source', 'memory')
        .field('name', 'toremove.txt');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify file doesn't exist
      const exists = await customAdapter.fileExists('toremove.txt');
      expect(exists).toBe(false);
    });

    it('should rename a file in in-memory storage', async () => {
      await customAdapter.write(
        'old-name.txt',
        Readable.from('rename test'),
        {}
      );

      const response = await request(testServer!.host)
        .post('/')
        .field('action', 'fileRename')
        .field('source', 'memory')
        .field('name', 'old-name.txt')
        .field('newname', 'new-name.txt');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify old name doesn't exist
      const oldExists = await customAdapter.fileExists('old-name.txt');
      expect(oldExists).toBe(false);

      // Verify new name exists
      const newExists = await customAdapter.fileExists('new-name.txt');
      expect(newExists).toBe(true);
    });
  });
});
