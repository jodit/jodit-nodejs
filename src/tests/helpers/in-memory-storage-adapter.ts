import { Readable } from 'stream';
import type {
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
export class InMemoryStorageAdapter implements StorageAdapter {
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
    if (
      this.directories.has(normalizedPath) ||
      normalizedPath === '' ||
      normalizedPath === '/'
    ) {
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

  async *list(
    path: string,
    options: { deep: boolean }
  ): AsyncGenerator<StatEntry> {
    const normalizedPath = this.normalizePath(path);
    const prefix = normalizedPath ? normalizedPath + '/' : '';
    const yielded = new Set<string>();

    // List files
    for (const [filePath, buffer] of this.files.entries()) {
      // Check if file is in this directory or subdirectory
      if (
        normalizedPath === '' ||
        normalizedPath === '/' ||
        filePath.startsWith(prefix)
      ) {
        const relativePath = normalizedPath
          ? filePath.substring(prefix.length)
          : filePath;

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
      if (
        normalizedPath === '' ||
        normalizedPath === '/' ||
        filePath.startsWith(prefix)
      ) {
        const relativePath = normalizedPath
          ? filePath.substring(prefix.length)
          : filePath;
        const parts = relativePath.split('/').filter(Boolean);

        if (parts.length > 1) {
          // This file is in a subdirectory
          const immediateDir = normalizedPath
            ? `${normalizedPath}/${parts[0]}`
            : parts[0];
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
    return (
      this.directories.has(normalizedPath) ||
      normalizedPath === '' ||
      normalizedPath === '/'
    );
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

  async moveFile(
    from: string,
    to: string,
    _options: MoveFileOptions
  ): Promise<void> {
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

  async copyFile(
    from: string,
    to: string,
    _options: CopyFileOptions
  ): Promise<void> {
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

  async temporaryUrl(
    _path: string,
    _options: TemporaryUrlOptions
  ): Promise<string> {
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
