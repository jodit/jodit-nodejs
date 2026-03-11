import type { Readable } from 'node:stream';
import type { FileStorage } from '@flystorage/file-storage';
import type { Config } from '../config/config';
import type { MulterFile, SourceConfig } from '../types';
import type { ISourceItem, ISourceFolders } from '../types/rest-api';
import { BaseSource } from '../helpers/base-source';
import type { FileManagerContext, IItemFile } from './file-manager';
import * as fm from './file-manager';

/**
 * FileManagerService - Business logic for file operations
 * Uses FileStorage for low-level file system access
 * Delegates to individual function modules for each operation
 */
export class FileManagerService extends BaseSource {
  private storage: FileStorage;

  constructor(
    sourceConfig: SourceConfig,
    config: Config,
    storage: FileStorage,
    name?: string
  ) {
    super(sourceConfig, config, name);
    this.storage = storage;
  }

  /**
   * Get context object for function calls
   */
  private getContext(): FileManagerContext {
    return {
      storage: this.storage,
      config: this.config,
      sourceConfig: this.sourceConfig,
      access: this.config.access,
      getRoot: this.getRoot.bind(this),
      getPath: this.getPath.bind(this),
      getExtension: this.getExtension.bind(this),
      isExcluded: this.isExcluded.bind(this),
      isGoodFile: this.isGoodFile.bind(this),
      isSafeFile: this.isSafeFile.bind(this),
      isImage: this.isImage.bind(this),
      name: this.name
    };
  }

  async isDirectory(pathname: string): Promise<boolean> {
    return fm.isDirectory(this.getContext(), pathname);
  }

  async items(
    relativePath: string,
    options: {
      withFolders: boolean;
      onlyImages: boolean;
      offset: number;
      limit: number;
      sortBy: string;
      foldersPosition: 'default' | 'top' | 'bottom';
      filterWord: string;
    }
  ): Promise<ISourceItem> {
    return fm.items(this.getContext(), relativePath, options);
  }

  async movePath(from: string, toPath?: string): Promise<void> {
    return fm.movePath(this.getContext(), from, toPath);
  }

  async fileDownload(
    target: string,
    relativePath?: string
  ): Promise<{ stream: Readable; size?: number }> {
    return fm.fileDownload(this.getContext(), target, relativePath);
  }

  async fileRemove(target: string, relativePath?: string): Promise<void> {
    return fm.fileRemove(this.getContext(), target, relativePath);
  }

  async renamePath(
    fromName: string,
    newName: string,
    relativePath?: string,
    expectType?: 'file' | 'folder'
  ): Promise<void> {
    return fm.renamePath(
      this.getContext(),
      fromName,
      newName,
      relativePath,
      expectType
    );
  }

  async folders(
    relativePath: string,
    options: { dots?: boolean | undefined }
  ): Promise<ISourceFolders> {
    return fm.folders(this.getContext(), relativePath, options);
  }

  async uploadFiles(files: MulterFile[]): Promise<IItemFile[]> {
    return fm.uploadFiles(this.getContext(), files);
  }

  async uploadFileFromUrl(
    url: string,
    relativePath?: string
  ): Promise<{
    baseurl: string;
    newfilename: string;
    isImage: boolean;
  }> {
    return fm.uploadFileFromUrl(this.getContext(), url, relativePath);
  }

  async makeFolder(name: string, relativePath?: string): Promise<void> {
    return fm.makeFolder(this.getContext(), name, relativePath);
  }

  async folderRemove(name: string, relativePath?: string): Promise<void> {
    return fm.folderRemove(this.getContext(), name, relativePath);
  }

  async resolveFileByUrl(url: string): Promise<{
    path: string;
    name: string;
    source: string;
    messages: string[];
    code: number;
  } | null> {
    return fm.resolveFileByUrl(this.getContext(), url);
  }

  async cropImage(
    name: string,
    box: { x: number; y: number; w: number; h: number },
    newName?: string,
    relativePath?: string
  ): Promise<string> {
    return fm.cropImage(this.getContext(), name, box, newName, relativePath);
  }

  async resizeImage(
    name: string,
    box: { w: number; h: number },
    newName?: string,
    relativePath?: string
  ): Promise<string> {
    return fm.resizeImage(this.getContext(), name, box, newName, relativePath);
  }
}
