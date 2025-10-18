---
title: Custom Storage Adapters
description: Complete guide to creating and using custom storage adapters in Jodit Connector Node.js for AWS S3, Azure Blob, Google Cloud Storage, and other backends.
---

# Custom Storage Adapters

## Overview

Jodit Connector supports custom storage adapters, allowing you to store files in any backend storage system (AWS S3, Azure Blob Storage, Google Cloud Storage, in-memory, database, etc.) instead of the default local filesystem.

Storage adapters provide a unified interface for file operations, making it easy to switch between different storage backends without changing your application code.

## How Storage Adapters Work

The connector uses the `@flystorage/file-storage` library, which provides a standardized `StorageAdapter` interface. All file operations (read, write, delete, list, etc.) go through this interface, allowing you to plug in any compatible adapter.

### Architecture

```
┌─────────────────────────┐
│  FileManagerService     │
│  (Business Logic)       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  FileStorage            │
│  (Wrapper)              │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  StorageAdapter         │
│  (Interface)            │
└───────────┬─────────────┘
            │
    ┌───────┴────────┐
    ▼                ▼
┌─────────┐    ┌──────────────┐
│  Local  │    │  Your Custom │
│  FS     │    │  Adapter     │
└─────────┘    └──────────────┘
```

## Configuration

### Using Local Filesystem (Default)

By default, sources use the local filesystem:

```typescript
import { startServer } from 'jodit-nodejs';

await startServer({
  sources: {
    default: {
      name: 'default',
      root: '/path/to/files',
      baseurl: '/files',
      // No storageAdapter specified = uses local filesystem
    }
  }
});
```

You can also explicitly specify local filesystem:

```typescript
await startServer({
  sources: {
    default: {
      name: 'default',
      root: '/path/to/files',
      baseurl: '/files',
      storageAdapter: 'local' // Explicit local filesystem
    }
  }
});
```

### Using a Custom Adapter

To use a custom storage adapter, pass an instance of `StorageAdapter`:

```typescript
import { startServer } from 'jodit-nodejs';
import { MyCustomAdapter } from './my-custom-adapter';

const customAdapter = new MyCustomAdapter({
  // Your adapter configuration
});

await startServer({
  sources: {
    custom: {
      name: 'custom',
      root: '/virtual/path', // Used for path validation
      baseurl: '/files/custom',
      storageAdapter: customAdapter // Your custom adapter
    }
  }
});
```

## Creating a Custom Adapter

### Required Interface

Your adapter must implement the `StorageAdapter` interface from `@flystorage/file-storage`:

```typescript
import { StorageAdapter, StatEntry, FileContents } from '@flystorage/file-storage';
import { Readable } from 'stream';

export class MyCustomAdapter implements StorageAdapter {
  // Core methods
  async write(path: string, contents: Readable, options: WriteOptions): Promise<void>
  async read(path: string): Promise<FileContents>
  async deleteFile(path: string): Promise<void>
  async createDirectory(path: string, options: CreateDirectoryOptions): Promise<void>
  async deleteDirectory(path: string): Promise<void>
  async stat(path: string): Promise<StatEntry>
  async *list(path: string, options: { deep: boolean }): AsyncGenerator<StatEntry>
  async fileExists(path: string): Promise<boolean>
  async directoryExists(path: string): Promise<boolean>
  async moveFile(from: string, to: string, options: MoveFileOptions): Promise<void>
  async copyFile(from: string, to: string, options: CopyFileOptions): Promise<void>

  // Optional methods (can throw "Not implemented")
  async changeVisibility(path: string, visibility: string): Promise<void>
  async visibility(path: string): Promise<string>
  async publicUrl(path: string, options: PublicUrlOptions): Promise<string>
  async temporaryUrl(path: string, options: TemporaryUrlOptions): Promise<string>
  async checksum(path: string, options: ChecksumOptions): Promise<string>
  async mimeType(path: string, options: MimeTypeOptions): Promise<string>
  async lastModified(path: string): Promise<number>
  async fileSize(path: string): Promise<number>
}
```

### Example: In-Memory Storage Adapter

Here's a complete example of an in-memory storage adapter:

```typescript
import {
  StorageAdapter,
  StatEntry,
  FileContents,
  WriteOptions,
  CreateDirectoryOptions,
  MoveFileOptions,
  CopyFileOptions
} from '@flystorage/file-storage';
import { Readable } from 'stream';

/**
 * In-Memory Storage Adapter
 * Stores files in memory as Map<path, Buffer>
 */
export class InMemoryStorageAdapter implements StorageAdapter {
  private files: Map<string, Buffer> = new Map();
  private directories: Set<string> = new Set();

  constructor() {
    // Root directory always exists
    this.directories.add('');
    this.directories.add('/');
  }

  // Write a file
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

  // Read a file
  async read(path: string): Promise<FileContents> {
    const normalizedPath = this.normalizePath(path);
    const buffer = this.files.get(normalizedPath);
    if (!buffer) {
      throw new Error(`File not found: ${path}`);
    }
    return Readable.from(buffer);
  }

  // Delete a file
  async deleteFile(path: string): Promise<void> {
    const normalizedPath = this.normalizePath(path);
    if (!this.files.has(normalizedPath)) {
      throw new Error(`File not found: ${path}`);
    }
    this.files.delete(normalizedPath);
  }

  // Create a directory
  async createDirectory(
    path: string,
    _options: CreateDirectoryOptions
  ): Promise<void> {
    this.directories.add(this.normalizePath(path));
  }

  // Get file/directory information
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

  // List files and directories
  async *list(path: string, options: { deep: boolean }): AsyncGenerator<StatEntry> {
    const normalizedPath = this.normalizePath(path);
    const prefix = normalizedPath ? normalizedPath + '/' : '';
    const yielded = new Set<string>();

    // List files
    for (const [filePath, buffer] of this.files.entries()) {
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

    // List directories
    const childDirs = new Set<string>();
    for (const dirPath of this.directories) {
      if (dirPath === '' || dirPath === '/') continue;

      if (normalizedPath === '' || normalizedPath === '/') {
        const parts = dirPath.split('/').filter(Boolean);
        if (options.deep) {
          childDirs.add(dirPath);
        } else if (parts.length === 1) {
          childDirs.add(dirPath);
        }
      } else if (dirPath.startsWith(prefix)) {
        const relativePath = dirPath.substring(prefix.length);
        const parts = relativePath.split('/').filter(Boolean);

        if (options.deep) {
          childDirs.add(dirPath);
        } else if (parts.length === 1) {
          childDirs.add(dirPath);
        }
      }
    }

    // Yield directories
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

  // Check if file exists
  async fileExists(path: string): Promise<boolean> {
    return this.files.has(this.normalizePath(path));
  }

  // Check if directory exists
  async directoryExists(path: string): Promise<boolean> {
    const normalizedPath = this.normalizePath(path);
    return this.directories.has(normalizedPath) || normalizedPath === '' || normalizedPath === '/';
  }

  // Delete a directory
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

  // Move/rename a file
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

  // Copy a file
  async copyFile(from: string, to: string, _options: CopyFileOptions): Promise<void> {
    const normalizedFrom = this.normalizePath(from);
    const normalizedTo = this.normalizePath(to);

    const buffer = this.files.get(normalizedFrom);
    if (!buffer) {
      throw new Error(`File not found: ${from}`);
    }

    this.files.set(normalizedTo, Buffer.from(buffer));

    const dir = this.getParentDir(to);
    if (dir) {
      this.directories.add(dir);
    }
  }

  // Optional methods - not needed for basic operations
  async changeVisibility(_path: string, _visibility: string): Promise<void> {
    throw new Error('Not implemented: changeVisibility');
  }

  async visibility(_path: string): Promise<string> {
    throw new Error('Not implemented: visibility');
  }

  async publicUrl(_path: string, _options: any): Promise<string> {
    throw new Error('Not implemented: publicUrl');
  }

  async temporaryUrl(_path: string, _options: any): Promise<string> {
    throw new Error('Not implemented: temporaryUrl');
  }

  async checksum(_path: string, _options: any): Promise<string> {
    throw new Error('Not implemented: checksum');
  }

  async mimeType(_path: string, _options: any): Promise<string> {
    throw new Error('Not implemented: mimeType');
  }

  async lastModified(path: string): Promise<number> {
    const stat = await this.stat(path);
    return stat.lastModifiedMs || Date.now();
  }

  async fileSize(path: string): Promise<number> {
    const stat = await this.stat(path);
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
```

## Real-World Examples

### AWS S3 Adapter

```typescript
import { AwsS3StorageAdapter } from '@flystorage/aws-s3';
import { S3Client } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});

const s3Adapter = new AwsS3StorageAdapter(s3Client, {
  bucket: 'my-bucket',
  prefix: 'uploads/'
});

await startServer({
  sources: {
    s3: {
      name: 's3',
      root: '/uploads',
      baseurl: 'https://my-bucket.s3.amazonaws.com/uploads',
      storageAdapter: s3Adapter
    }
  }
});
```

### Azure Blob Storage Adapter

```typescript
import { AzureBlobStorageAdapter } from '@flystorage/azure-blob';
import { BlobServiceClient } from '@azure/storage-blob';

const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING!
);

const containerClient = blobServiceClient.getContainerClient('uploads');

const azureAdapter = new AzureBlobStorageAdapter(containerClient);

await startServer({
  sources: {
    azure: {
      name: 'azure',
      root: '/uploads',
      baseurl: 'https://myaccount.blob.core.windows.net/uploads',
      storageAdapter: azureAdapter
    }
  }
});
```

### Multiple Sources with Different Adapters

You can mix local and remote storage in a single application:

```typescript
import { AwsS3StorageAdapter } from '@flystorage/aws-s3';
import { S3Client } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});

const s3Adapter = new AwsS3StorageAdapter(s3Client, {
  bucket: 'my-bucket',
  prefix: 'public/'
});

await startServer({
  sources: {
    // Local filesystem for temporary files
    temp: {
      name: 'temp',
      root: '/tmp/uploads',
      baseurl: '/files/temp',
      storageAdapter: 'local'
    },
    // S3 for permanent storage
    permanent: {
      name: 'permanent',
      root: '/public',
      baseurl: 'https://my-bucket.s3.amazonaws.com/public',
      storageAdapter: s3Adapter
    }
  }
});
```

## Testing Your Adapter

Create integration tests to verify your adapter works correctly:

```typescript
import request from 'supertest';
import { startTestServer, stopTestServer } from './test-server';
import { MyCustomAdapter } from './my-custom-adapter';

describe('My Custom Adapter Integration', () => {
  let testServer;
  const customAdapter = new MyCustomAdapter();

  beforeAll(async () => {
    testServer = await startTestServer({
      sources: {
        custom: {
          name: 'custom',
          root: process.cwd(),
          baseurl: 'http://localhost:8080/files/custom/',
          storageAdapter: customAdapter
        }
      }
    });
  });

  afterAll(async () => {
    await stopTestServer(testServer);
  });

  it('should list files from custom storage', async () => {
    const response = await request(testServer.host)
      .get('/')
      .query({
        action: 'files',
        source: 'custom',
        mods: { withFolders: true }
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should upload a file to custom storage', async () => {
    const response = await request(testServer.host)
      .post('/')
      .field('action', 'fileUpload')
      .field('source', 'custom')
      .attach('files', Buffer.from('test content'), 'test.txt');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should download a file from custom storage', async () => {
    const response = await request(testServer.host)
      .get('/')
      .query({
        action: 'fileDownload',
        source: 'custom',
        name: 'test.txt'
      });

    expect(response.status).toBe(200);
    expect(response.body.toString()).toBe('test content');
  });
});
```

## Best Practices

### 1. Path Normalization

Always normalize paths to avoid issues with leading/trailing slashes:

```typescript
private normalizePath(path: string): string {
  return path.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
}
```

### 2. Error Handling

Throw meaningful errors when operations fail:

```typescript
async read(path: string): Promise<FileContents> {
  const file = await this.getFile(path);
  if (!file) {
    throw new Error(`File not found: ${path}`);
  }
  return Readable.from(file.content);
}
```

### 3. Stream Handling

Use streams for file content to handle large files efficiently:

```typescript
async write(path: string, contents: Readable): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of contents) {
    chunks.push(Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks);
  await this.saveFile(path, buffer);
}
```

### 4. Async Operations

Use async/await consistently for all operations:

```typescript
async stat(path: string): Promise<StatEntry> {
  const metadata = await this.getMetadata(path);
  return {
    path,
    type: metadata.isDirectory ? 'directory' : 'file',
    size: metadata.size,
    lastModifiedMs: metadata.lastModified.getTime(),
    isFile: !metadata.isDirectory,
    isDirectory: metadata.isDirectory
  };
}
```

### 5. Generator for Listing

Use async generators for listing to handle large directories efficiently:

```typescript
async *list(path: string, options: { deep: boolean }): AsyncGenerator<StatEntry> {
  const items = await this.getItems(path);
  for (const item of items) {
    yield await this.stat(item.path);
    if (options.deep && item.isDirectory) {
      yield* this.list(item.path, options);
    }
  }
}
```

## Common Pitfalls

### 1. Forgetting to Normalize Paths

Different systems use different path separators. Always normalize:

```typescript
// ❌ Wrong
this.files.set(path, buffer);

// ✅ Correct
this.files.set(this.normalizePath(path), buffer);
```

### 2. Not Handling Root Directory

Root directory (`/` or `''`) requires special handling:

```typescript
async stat(path: string): Promise<StatEntry> {
  const normalized = this.normalizePath(path);

  // Handle root directory
  if (normalized === '' || normalized === '/') {
    return {
      path: normalized,
      type: 'directory',
      isFile: false,
      isDirectory: true
    };
  }

  // ... rest of implementation
}
```

### 3. Not Creating Parent Directories

When writing a file, ensure parent directories exist:

```typescript
async write(path: string, contents: Readable): Promise<void> {
  const buffer = await this.readStream(contents);
  this.files.set(path, buffer);

  // Create parent directory
  const parentDir = this.getParentDir(path);
  if (parentDir) {
    this.directories.add(parentDir);
  }
}
```

### 4. Not Handling Deep Listing

The `list()` method must respect the `deep` option:

```typescript
async *list(path: string, options: { deep: boolean }): AsyncGenerator<StatEntry> {
  for (const item of this.items) {
    if (!options.deep && item.path.split('/').length > depth) {
      continue; // Skip nested items for shallow listing
    }
    yield item;
  }
}
```

## Available Adapters

The `@flystorage` ecosystem provides ready-to-use adapters:

- **[@flystorage/local-fs](https://github.com/duna-oss/flystorage/tree/main/packages/local-fs)** - Local filesystem (default)
- **[@flystorage/aws-s3](https://github.com/duna-oss/flystorage/tree/main/packages/aws-s3)** - Amazon S3
- **[@flystorage/azure-blob](https://github.com/duna-oss/flystorage/tree/main/packages/azure-blob)** - Azure Blob Storage
- **[@flystorage/google-cloud-storage](https://github.com/duna-oss/flystorage/tree/main/packages/google-cloud-storage)** - Google Cloud Storage
- **[@flystorage/ftp](https://github.com/duna-oss/flystorage/tree/main/packages/ftp)** - FTP/FTPS
- **[@flystorage/sftp](https://github.com/duna-oss/flystorage/tree/main/packages/sftp)** - SFTP

## Troubleshooting

### "Path not found" errors

Ensure your adapter handles root paths correctly:

```typescript
const normalized = this.normalizePath(path);
if (normalized === '' || normalized === '/') {
  // Handle root directory
}
```

### "File not found" when listing

Check that your `list()` method returns all files including in subdirectories:

```typescript
async *list(path: string, options: { deep: boolean }) {
  // Ensure you're checking the prefix correctly
  const prefix = path ? path + '/' : '';
  for (const [filePath, _] of this.files) {
    if (filePath.startsWith(prefix) || prefix === '') {
      yield await this.stat(filePath);
    }
  }
}
```

### Directories not showing up

Ensure directories are included in `list()` results:

```typescript
async *list(path: string, options: { deep: boolean }) {
  // First yield files
  for (const file of files) {
    yield file;
  }

  // Then yield directories
  for (const dir of directories) {
    yield dir;
  }
}
```

## Additional Resources

- [Flystorage Documentation](https://github.com/duna-oss/flystorage)
- [StorageAdapter Interface](https://github.com/duna-oss/flystorage/blob/main/packages/file-storage/src/storage-adapter.ts)
- [Example: In-Memory Adapter Test](https://github.com/jodit/jodit-nodejs/blob/main/src/tests/integration/custom-storage-adapter.test.ts)

## Support

If you need help creating a custom storage adapter:

1. Check the [example implementation](https://github.com/jodit/jodit-nodejs/blob/main/src/tests/integration/custom-storage-adapter.test.ts)
2. Review the [StorageAdapter interface documentation](https://github.com/duna-oss/flystorage)
3. Open an issue on [GitHub](https://github.com/jodit/jodit-nodejs/issues)
