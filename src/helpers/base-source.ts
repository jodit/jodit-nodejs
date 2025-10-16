import path from 'node:path';
import Boom from '@hapi/boom';
import type { SourceConfig } from '../types';
import type { Config } from '../config/config';
import { StatEntry } from '@flystorage/file-storage';

export abstract class BaseSource {
  readonly name: string;
  readonly config: Config;
  readonly sourceConfig: SourceConfig;

  constructor(sourceConfig: SourceConfig, config: Config, name?: string) {
    this.sourceConfig = sourceConfig;
    this.config = config;
    this.name = name ?? sourceConfig.name ?? 'default';
  }

  abstract isDirectory(pathname: string): Promise<boolean>;

  async getRoot(): Promise<string> {
    if (this.sourceConfig.root) {
      return path.resolve(this.sourceConfig.root);
    }

    throw Boom.notImplemented('Set root directory for source');
  }

  async getPath(relativePath?: string): Promise<string> {
    let root = await this.getRoot();

    let pathname = path.resolve(
      normalizePath(path.join(root, relativePath ?? './'))
    );

    //always check whether we are below the root category is not reached
    if (pathname && pathname.startsWith(root) !== false) {
      root = pathname;
    } else {
      throw Boom.notFound('Path does not exist');
    }

    return root;
  }

  isExcluded(file: StatEntry): boolean {
    const name = path.basename(file.path);
    return (
      (this.config.params.createThumb &&
        name === this.config.params.thumbFolderName) ||
      this.config.params.excludeDirectoryNames.includes(name)
    );
  }

  isGoodFile(file: StatEntry): boolean {
    const ext = this.getExtension(file.path);
    return !!ext && this.config.params.extensions.includes(ext);
  }

  isSafeFile(file: StatEntry): boolean {
    const ext = this.getExtension(file.path);

    if (!this.isGoodFile(file)) return false;

    if (
      this.config.params.imageExtensions.includes(ext) &&
      !this.isImage(file)
    ) {
      return false;
    }

    return true;
  }

  isImage(file: StatEntry): boolean {
    const ext = this.getExtension(file.path);
    if (ext === 'svg') return true;

    return this.config.params.imageExtensions.includes(ext);
  }

  protected getExtension(filePath: string): string {
    return path.extname(filePath).toLowerCase().replace(/^./, '');
  }
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}
