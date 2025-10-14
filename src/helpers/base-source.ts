import path from 'node:path';
import Boom from '@hapi/boom';
import type { SourceConfig } from '../types';
import type { Config } from '../config/config';

export abstract class BaseSource {
  readonly name: string;
  readonly config: Config;
  readonly sourceConfig: SourceConfig;

  constructor(
    sourceConfig: SourceConfig,
    config: Config,
    name?: string
  ) {
    this.sourceConfig = sourceConfig;
    this.config = config;
    this.name = name ?? sourceConfig.name ?? 'default';
  }

  abstract realpath(pathname: string): Promise<string>;
  abstract isDirectory(pathname: string): Promise<boolean>;

  async getRoot(): Promise<string> {
    if (this.sourceConfig.root) {
      if (!(await this.isDirectory(this.sourceConfig.root))) {
        throw Boom.notFound('Root directory not exists ' + this.sourceConfig.root);
      }

      return this.realpath(this.sourceConfig.root);
    }

    throw Boom.notImplemented('Set root directory for source');
  }

  async getPath(relativePath?: string): Promise<string> {
    let root = await this.getRoot();

    let pathname = await this.realpath(
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
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}
