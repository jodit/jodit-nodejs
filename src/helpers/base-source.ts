import path from 'node:path';
import fs from 'node:fs/promises';
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
    const root = await this.getRoot();

    const pathname = path.resolve(
      normalizePath(path.join(root, relativePath ?? './'))
    );

    // Strict boundary check: require exact match or proper separator
    if (!isPathWithinRoot(pathname, root)) {
      throw Boom.notFound('Path does not exist');
    }

    // Verify symlinks don't escape root
    await verifyRealPath(pathname, root);

    return pathname;
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

  protected getExtension(fileOrPath: string | StatEntry): string {
    const filePath =
      typeof fileOrPath === 'string' ? fileOrPath : fileOrPath.path;
    return path.extname(filePath).toLowerCase().replace(/^./, '');
  }
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

/**
 * Check whether pathname is exactly root or a proper subdirectory of root.
 * Prevents prefix collision attacks like "/var/uploads-evil" matching "/var/uploads".
 */
export function isPathWithinRoot(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(root + path.sep);
}

/**
 * Verify that the real filesystem path (after resolving symlinks)
 * is still within root. Prevents symlink escape attacks.
 */
export async function verifyRealPath(
  pathname: string,
  root: string
): Promise<void> {
  try {
    const realRoot = await fs.realpath(root);
    const realPathname = await fs.realpath(pathname);

    if (!isPathWithinRoot(realPathname, realRoot)) {
      throw Boom.notFound('Path does not exist');
    }
  } catch (err) {
    if ((err as { code?: string }).code === 'ENOENT') {
      // Path doesn't exist on disk yet — logical check above is sufficient
      return;
    }

    if (Boom.isBoom(err)) {
      throw err;
    }

    throw Boom.notFound('Path does not exist');
  }
}
