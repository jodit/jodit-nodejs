import os from 'os';
import { AsyncLocalStorage } from 'async_hooks';
import { AccessControl } from '../helpers/access-control';
import { FileManagerService } from '../services/file-manager.service';
import type { AppConfig, SourceConfig, IAccessControl } from '../types';
import Boom from '@hapi/boom';
import { logger } from '../helpers/logger';
import { LocalStorageAdapter } from '@flystorage/local-fs';
import { FileStorage } from '@flystorage/file-storage';

// AsyncLocalStorage for storing request-specific context
export const requestStorage = new AsyncLocalStorage<{ userRole: string }>();

/**
 * Create a proxied config that allows source-specific overrides.
 * The proxy will first check if a property exists in sourceConfig,
 * and fall back to the global config if not found.
 *
 * This allows each source to have its own configuration overrides
 * for any AppConfig property (except 'sources').
 *
 * @param baseConfig - The global configuration object
 * @param sourceConfig - The source-specific configuration with potential overrides
 * @returns A new Config object with proxied params
 *
 * @example
 * ```typescript
 * const config = new Config(appConfig);
 * const sourceConfig: SourceConfig = {
 *   name: 'mySource',
 *   root: '/path/to/files',
 *   baseurl: 'http://example.com/files',
 *   extensions: ['jpg', 'png'], // Override global extensions
 *   maxUploadFileSize: '5MB'    // Override global max size
 * };
 * const proxiedConfig = createProxiedConfig(config, sourceConfig);
 * // proxiedConfig.params.extensions will return ['jpg', 'png']
 * // proxiedConfig.params.thumbSize will return global config value
 * ```
 */
export function createProxiedConfig(
  baseConfig: Config,
  sourceConfig: SourceConfig
): Config {
  const proxiedParams = new Proxy(baseConfig.params, {
    get<Key extends keyof AppConfig>(
      target: AppConfig,
      prop: Key
    ): AppConfig[Key] {
      // Don't allow overriding 'sources' at source level to prevent circular references
      if (prop === 'sources') {
        return target[prop];
      }

      // Check if source has override for this property
      if (prop in sourceConfig && sourceConfig[prop] !== undefined) {
        return sourceConfig[prop];
      }

      // Fall back to global config
      return target[prop];
    }
  });

  // Create a new Config-like object with proxied params
  return {
    params: proxiedParams,
    access: baseConfig.access,
    getUserRole: baseConfig.getUserRole.bind(baseConfig),
    getSources: baseConfig.getSources.bind(baseConfig)
  } as Config;
}

export class Config {
  access: IAccessControl;
  private accessInitialized: Promise<void>;

  private sources: { [key: string]: Promise<FileManagerService> } = {};

  async makeSource(
    sourceConfig: SourceConfig,
    config: Config,
    name: string
  ): Promise<FileManagerService> {
    // Determine which storage adapter to use
    let storageAdapter;

    if (
      !sourceConfig.storageAdapter ||
      sourceConfig.storageAdapter === 'local'
    ) {
      // Default: use LocalStorageAdapter
      storageAdapter = new LocalStorageAdapter(sourceConfig.root);
    } else {
      // Use custom storage adapter provided by user
      storageAdapter = sourceConfig.storageAdapter;
    }

    const storage = new FileStorage(storageAdapter);

    // Create a proxied config that allows source-specific overrides
    const proxiedConfig = createProxiedConfig(config, sourceConfig);

    // Create FileManagerService with the storage adapter and proxied config
    return new FileManagerService(sourceConfig, proxiedConfig, storage, name);
  }

  constructor(public readonly params: AppConfig) {
    // Use custom AccessControl instance if provided, otherwise create default
    if (params.accessControlInstance) {
      this.access = params.accessControlInstance;
    } else {
      // Create AccessControl with either static array or async function
      const accessControl = this.params.accessControl;

      if (typeof accessControl === 'function') {
        // Pass async function directly to AccessControl
        this.access = new AccessControl(accessControl);
      } else {
        // Pass static array to AccessControl
        this.access = new AccessControl(accessControl);
      }
    }

    // No need for async initialization anymore
    this.accessInitialized = Promise.resolve();

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
  }): Promise<FileManagerService[]> {
    // Wait for access control to be initialized
    await this.accessInitialized;

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
