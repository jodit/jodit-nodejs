import os from 'os';
import { AsyncLocalStorage } from 'async_hooks';
import { AccessControl } from '../helpers/access-control';
import { FileSystem } from '../sources/file-system/file-system';
import { AppConfig, SourceConfig } from '../types';
import type { ISource } from '../types/abstract-file-system';
import Boom from '@hapi/boom';
import { logger } from '../helpers/logger';

// AsyncLocalStorage for storing request-specific context
export const requestStorage = new AsyncLocalStorage<{ userRole: string }>();

export class Config {
  access: AccessControl;

  private sources: { [key: string]: Promise<ISource> } = {};

  async makeSource(
    sourceConfig: SourceConfig,
    config: Config,
    name: string
  ): Promise<ISource> {
    // TODO Another source types
    return new FileSystem(sourceConfig, config, name);
  }

  constructor(public readonly params: AppConfig) {
    this.access = new AccessControl(params.accessControl);

    if (this.params.sources != null) {
      for (const sourceConfigName in this.params.sources) {
        this.sources[sourceConfigName] = this.makeSource(
          this.params.sources[sourceConfigName]!,
          this,
          sourceConfigName
        );
      }
    } else {
      this.sources['default'] = this.makeSource(
        {
          title: 'Default',
          name: 'default',
          root: os.homedir(),
          baseurl: params.baseurl || '/files'
        },
        this,
        'default'
      );
    }
  }

  async getSources(options: {
    source?: string;
    action: string;
  }): Promise<ISource[]> {
    let sources = await Promise.all(Object.values(this.sources));
    if (options.source) {
      sources = sources.filter(source => source.name === options.source);

      if (sources.length === 0) {
        throw Boom.notFound('Source not found');
      }
    }

    for (const source of sources) {
      const path = await source.getPath();

      try {
        await this.access.checkPermission(
          await this.getUserRole(),
          options.action,
          path
        );
      } catch {
        logger.warn(
          `Access denied for source ${source.sourceConfig.name} action ${options.action} path ${path}`
        );
        continue;
      }
    }

    return sources;
  }

  async getUserRole(): Promise<string> {
    // Priority: 1. Request-scoped role (from checkAuthentication)
    //           2. Default role (from config)
    const store = requestStorage.getStore();
    if (store?.userRole) {
      return store.userRole;
    }

    return this.params.defaultRole;
  }
}
