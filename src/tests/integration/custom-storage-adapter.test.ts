import request from 'supertest';
import {
  startTestServer,
  stopTestServer,
  TestServer
} from '../test-server';
import { Readable } from 'stream';
import {
  StorageAdapter,
  StatEntry,
  FileContents,
  WriteOptions,
  CreateDirectoryOptions,
  PublicUrlOptions,
  TemporaryUrlOptions,
  ChecksumOptions,
  MimeTypeOptions,
  CopyFileOptions,
  MoveFileOptions
} from '@flystorage/file-storage';

/**
 * In-Memory Storage Adapter for testing
 * Stores files in memory as Map<path, Buffer>
 */
class InMemoryStorageAdapter implements StorageAdapter {
  private files: Map<string, Buffer> = new Map();
  private directories: Set<string> = new Set();

  constructor() {
    // Root directory always exists
    this.directories.add('');
    this.directories.add('/');
  }

  async write(
    path: string,
    contents: Readable,
    _options: WriteOptions
  ): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of contents) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    this.files.set(this.normalizePath(path), buffer);

    // Ensure parent directory exists
    const dir = this.getParentDir(path);
    if (dir) {
      this.directories.add(dir);
    }
  }

  async read(path: string): Promise<FileContents> {
    const normalizedPath = this.normalizePath(path);
    const buffer = this.files.get(normalizedPath);
    if (!buffer) {
      throw new Error(`File not found: ${path}`);
    }
    return Readable.from(buffer);
  }

  async deleteFile(path: string): Promise<void> {
    const normalizedPath = this.normalizePath(path);
    if (!this.files.has(normalizedPath)) {
      throw new Error(`File not found: ${path}`);
    }
    this.files.delete(normalizedPath);
  }

  async createDirectory(
    path: string,
    _options: CreateDirectoryOptions
  ): Promise<void> {
    this.directories.add(this.normalizePath(path));
  }

  async stat(path: string): Promise<StatEntry> {
    const normalizedPath = this.normalizePath(path);

    // Check if it's a file
    if (this.files.has(normalizedPath)) {
      const buffer = this.files.get(normalizedPath)!;
      return {
        path: normalizedPath,
        type: 'file',
        size: buffer.length,
        lastModifiedMs: Date.now(),
        isFile: true,
        isDirectory: false
      };
    }

    // Check if it's a directory
    if (this.directories.has(normalizedPath) || normalizedPath === '' || normalizedPath === '/') {
      return {
        path: normalizedPath,
        type: 'directory',
        lastModifiedMs: Date.now(),
        isFile: false,
        isDirectory: true
      };
    }

    throw new Error(`Path not found: ${path}`);
  }

  async *list(path: string, options: { deep: boolean }): AsyncGenerator<StatEntry> {
    const normalizedPath = this.normalizePath(path);
    const prefix = normalizedPath ? normalizedPath + '/' : '';
    const yielded = new Set<string>();

    // List files
    for (const [filePath, buffer] of this.files.entries()) {
      // Check if file is in this directory or subdirectory
      if (normalizedPath === '' || normalizedPath === '/' || filePath.startsWith(prefix)) {
        const relativePath = normalizedPath ? filePath.substring(prefix.length) : filePath;

        // For non-deep listing, only include direct children
        if (!options.deep && relativePath.includes('/')) {
          continue;
        }

        if (!yielded.has(filePath)) {
          yielded.add(filePath);
          yield {
            path: filePath,
            type: 'file',
            size: buffer.length,
            lastModifiedMs: Date.now(),
            isFile: true,
            isDirectory: false
          };
        }
      }
    }

    // List directories - need to find immediate child directories
    const childDirs = new Set<string>();

    for (const dirPath of this.directories) {
      // Skip root and current directory
      if (dirPath === '' || dirPath === '/') {
        continue;
      }

      // For root level listing
      if (normalizedPath === '' || normalizedPath === '/') {
        const parts = dirPath.split('/').filter(Boolean);
        if (options.deep) {
          childDirs.add(dirPath);
        } else if (parts.length === 1) {
          // Only immediate children at root
          childDirs.add(dirPath);
        }
      } else if (dirPath.startsWith(prefix)) {
        // For subdirectory listing
        const relativePath = dirPath.substring(prefix.length);
        const parts = relativePath.split('/').filter(Boolean);

        if (options.deep) {
          childDirs.add(dirPath);
        } else if (parts.length === 1) {
          // Only immediate children
          childDirs.add(dirPath);
        }
      }
    }

    // Also check for implicit directories (directories that contain files but weren't explicitly created)
    for (const filePath of this.files.keys()) {
      if (normalizedPath === '' || normalizedPath === '/' || filePath.startsWith(prefix)) {
        const relativePath = normalizedPath ? filePath.substring(prefix.length) : filePath;
        const parts = relativePath.split('/').filter(Boolean);

        if (parts.length > 1) {
          // This file is in a subdirectory
          const immediateDir = normalizedPath ? `${normalizedPath}/${parts[0]}` : parts[0];
          if (!options.deep) {
            childDirs.add(immediateDir);
          }
        }
      }
    }

    // Yield all child directories
    for (const dirPath of childDirs) {
      if (!yielded.has(dirPath)) {
        yielded.add(dirPath);
        yield {
          path: dirPath,
          type: 'directory',
          lastModifiedMs: Date.now(),
          isFile: false,
          isDirectory: true
        };
      }
    }
  }

  async fileExists(path: string): Promise<boolean> {
    return this.files.has(this.normalizePath(path));
  }

  async directoryExists(path: string): Promise<boolean> {
    const normalizedPath = this.normalizePath(path);
    return this.directories.has(normalizedPath) || normalizedPath === '' || normalizedPath === '/';
  }

  async deleteDirectory(path: string): Promise<void> {
    const normalizedPath = this.normalizePath(path);

    // Delete all files in this directory
    const filesToDelete: string[] = [];
    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(normalizedPath + '/')) {
        filesToDelete.push(filePath);
      }
    }
    for (const filePath of filesToDelete) {
      this.files.delete(filePath);
    }

    // Delete all subdirectories
    const dirsToDelete: string[] = [];
    for (const dirPath of this.directories) {
      if (dirPath.startsWith(normalizedPath + '/')) {
        dirsToDelete.push(dirPath);
      }
    }
    for (const dirPath of dirsToDelete) {
      this.directories.delete(dirPath);
    }

    // Delete the directory itself
    this.directories.delete(normalizedPath);
  }

  async moveFile(from: string, to: string, _options: MoveFileOptions): Promise<void> {
    const normalizedFrom = this.normalizePath(from);
    const normalizedTo = this.normalizePath(to);

    const buffer = this.files.get(normalizedFrom);
    if (!buffer) {
      throw new Error(`File not found: ${from}`);
    }

    this.files.set(normalizedTo, buffer);
    this.files.delete(normalizedFrom);

    // Ensure parent directory of destination exists
    const dir = this.getParentDir(to);
    if (dir) {
      this.directories.add(dir);
    }
  }

  async copyFile(from: string, to: string, _options: CopyFileOptions): Promise<void> {
    const normalizedFrom = this.normalizePath(from);
    const normalizedTo = this.normalizePath(to);

    const buffer = this.files.get(normalizedFrom);
    if (!buffer) {
      throw new Error(`File not found: ${from}`);
    }

    this.files.set(normalizedTo, Buffer.from(buffer));

    // Ensure parent directory of destination exists
    const dir = this.getParentDir(to);
    if (dir) {
      this.directories.add(dir);
    }
  }

  // Unimplemented methods (not needed for basic tests)
  async changeVisibility(_path: string, _visibility: string): Promise<void> {
    throw new Error('Not implemented: changeVisibility');
  }

  async visibility(_path: string): Promise<string> {
    throw new Error('Not implemented: visibility');
  }

  async publicUrl(_path: string, _options: PublicUrlOptions): Promise<string> {
    throw new Error('Not implemented: publicUrl');
  }

  async temporaryUrl(_path: string, _options: TemporaryUrlOptions): Promise<string> {
    throw new Error('Not implemented: temporaryUrl');
  }

  async checksum(_path: string, _options: ChecksumOptions): Promise<string> {
    throw new Error('Not implemented: checksum');
  }

  async mimeType(_path: string, _options: MimeTypeOptions): Promise<string> {
    throw new Error('Not implemented: mimeType');
  }

  async lastModified(_path: string): Promise<number> {
    const stat = await this.stat(_path);
    return stat.lastModifiedMs || Date.now();
  }

  async fileSize(_path: string): Promise<number> {
    const stat = await this.stat(_path);

    if (stat.type !== 'file') {
      throw new Error(`Path is not a file: ${_path}`);
    }

    return stat.size || 0;
  }

  // Helper methods
  private normalizePath(path: string): string {
    // Remove leading/trailing slashes and normalize
    let normalized = path.replace(/^\/+|\/+$/g, '');
    // Replace multiple slashes with single slash
    normalized = normalized.replace(/\/+/g, '/');
    return normalized;
  }

  private getParentDir(path: string): string | null {
    const normalized = this.normalizePath(path);
    const lastSlash = normalized.lastIndexOf('/');
    if (lastSlash === -1) {
      return '';
    }
    return normalized.substring(0, lastSlash);
  }
}

describe('Custom Storage Adapter Integration', () => {
  let testServer: TestServer | null = null;
  const customAdapter = new InMemoryStorageAdapter();

  beforeAll(async () => {
    // Seed some initial data in the adapter
    await customAdapter.write('test.txt', Readable.from('Hello World'), {});
    await customAdapter.write('image.png', Readable.from('fake-png-data'), {});
    await customAdapter.createDirectory('subdir', {});
    await customAdapter.write('subdir/nested.txt', Readable.from('Nested file'), {});

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
      const response = await request(testServer!.host)
        .get('/')
        .query({
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
      await customAdapter.write('old-name.txt', Readable.from('rename test'), {});

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
