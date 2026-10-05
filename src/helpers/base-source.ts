import path from 'node:path';
import fs from 'node:fs/promises';
import Boom from '@hapi/boom';
import type { SourceConfig } from '../types';
import type { Config } from '../config/config';
import { StatEntry } from '@flystorage/file-storage';
import { isLocalStorageSource } from '../storage/registry';

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

  /**
   * Remote adapters (S3, custom instances) work on a virtual root: paths
   * are still confined to `root`, but the local filesystem is never asked
   * about symlinks because nothing lives there.
   */
  isVirtualRoot(): boolean {
    return !isLocalStorageSource(this.sourceConfig);
  }

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
    if (!this.isVirtualRoot()) {
      await verifyRealPath(pathname, root);
    }

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
  const base = root.endsWith(path.sep) ? root : root + path.sep;
  return pathname === root || pathname.startsWith(base);
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
    // The root is resolved the same way: a source directory that has not been
    // created yet is normal (the first upload makes it), and requiring it to
    // exist would turn that into a 404.
    const realRoot = await resolveExistingAncestor(root);
    const realPathname = await resolveExistingAncestor(pathname);

    if (!isPathWithinRoot(realPathname, realRoot)) {
      throw Boom.notFound('Path does not exist');
    }
  } catch (err) {
    if (Boom.isBoom(err)) {
      throw err;
    }

    throw Boom.notFound('Path does not exist');
  }
}

/**
 * Where a path will end up, for a path that does not exist yet.
 *
 * `fs.realpath` only works on something that is already there, and skipping
 * the check for everything else was enough to walk out of the root: with a
 * symlinked folder inside it (`root/link -> /etc`), `/link` was refused but
 * `/link/new` was not, so a folder, an upload or the target of a rename could
 * be created behind the link. Resolving the deepest part that does exist and
 * re-attaching the rest gives the real location of a path about to be created.
 */
async function resolveExistingAncestor(pathname: string): Promise<string> {
  const missing: string[] = [];
  let current = path.resolve(pathname);

  for (;;) {
    try {
      const real = await fs.realpath(current);

      return missing.length === 0 ? real : path.join(real, ...missing);
    } catch (err) {
      if ((err as { code?: string }).code !== 'ENOENT') {
        throw err;
      }
    }

    const parent = path.dirname(current);

    if (parent === current) {
      // Walked up to the filesystem root without finding anything that exists.
      return path.resolve(pathname);
    }

    missing.unshift(path.basename(current));
    current = parent;
  }
}
