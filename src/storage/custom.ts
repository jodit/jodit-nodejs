import { Readable } from 'stream';
import {
  StorageAdapter,
  ChecksumOptions,
  CreateDirectoryOptions,
  FileContents,
  MimeTypeOptions,
  PublicUrlOptions,
  StatEntry,
  TemporaryUrlOptions,
  WriteOptions,
  PathPrefixer,
  CopyFileOptions,
  MoveFileOptions
} from '@flystorage/file-storage';

export type AdapterFileStorageOptions = {
  prefix?: string;
};

export class AdapterFileStorage implements StorageAdapter {
  private readonly prefixer: PathPrefixer;

  constructor(private readonly options: AdapterFileStorageOptions = {}) {
    this.prefixer = new PathPrefixer(options.prefix || '');
  }

  async write(
    _path: string,
    _contents: Readable,
    _options: WriteOptions
  ): Promise<void> {
    throw new Error('Not implemented');
  }

  async read(_path: string): Promise<FileContents> {
    throw new Error('Not implemented');
  }
  async deleteFile(_path: string): Promise<void> {
    throw new Error('Not implemented');
  }
  async createDirectory(
    _path: string,
    _options: CreateDirectoryOptions
  ): Promise<void> {
    throw new Error('Not implemented');
  }
  async stat(_path: string): Promise<StatEntry> {
    throw new Error('Not implemented');
  }
  list(_path: string, _options: { deep: boolean }): AsyncGenerator<StatEntry> {
    throw new Error('Not implemented');
  }
  async changeVisibility(_path: string, _visibility: string): Promise<void> {
    throw new Error('Not implemented');
  }
  async visibility(_path: string): Promise<string> {
    throw new Error('Not implemented');
  }
  async deleteDirectory(_path: string): Promise<void> {
    throw new Error('Not implemented');
  }
  async fileExists(_path: string): Promise<boolean> {
    throw new Error('Not implemented');
  }
  async directoryExists(_path: string): Promise<boolean> {
    throw new Error('Not implemented');
  }
  async publicUrl(_path: string, _options: PublicUrlOptions): Promise<string> {
    throw new Error('Not implemented');
  }
  async temporaryUrl(
    _path: string,
    _options: TemporaryUrlOptions
  ): Promise<string> {
    throw new Error('Not implemented');
  }
  async checksum(_path: string, _options: ChecksumOptions): Promise<string> {
    throw new Error('Not implemented');
  }
  async mimeType(_path: string, _options: MimeTypeOptions): Promise<string> {
    throw new Error('Not implemented');
  }
  async lastModified(_path: string): Promise<number> {
    throw new Error('Not implemented');
  }
  async fileSize(_path: string): Promise<number> {
    throw new Error('Not implemented');
  }
  async copyFile(
    _from: string,
    _to: string,
    _options: CopyFileOptions
  ): Promise<void> {
    throw new Error('Not implemented');
  }
  async moveFile(
    _from: string,
    _to: string,
    _options: MoveFileOptions
  ): Promise<void> {
    throw new Error('Not implemented');
  }
}
