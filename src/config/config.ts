import os from 'os';
import { AsyncLocalStorage } from 'async_hooks';
import type { Request } from 'express';
import { AccessControl } from '../helpers/access-control';
import { FileManagerService } from '../services/file-manager.service';
import type { AppConfig, SourceConfig, IAccessControl } from '../types';
import Boom from '@hapi/boom';
import { logger } from '../helpers/logger';
import { FileStorage } from '@flystorage/file-storage';
import {
  createStorageAdapter,
  isLocalStorageSource
} from '../storage/registry';

export type SourcesPool = { [key: string]: Promise<FileManagerService> };

export interface RequestStore {
  userRole: string;
  /** Sources resolved for this request by `resolveSources` (multi-tenant mode) */
  sources?: SourcesPool | undefined;
}

// AsyncLocalStorage for storing request-specific context
export const requestStorage = new AsyncLocalStorage<RequestStore>();

const VIRTUAL_ROOT = '/';
const DEFAULT_DYNAMIC_CACHE_MAX = 200;
const DEFAULT_DYNAMIC_CACHE_TTL_MS = 60_000;

interface DynamicCacheEntry {
  expiresAt: number;
  sources: SourcesPool;
}

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

  private sources: SourcesPool = {};
  private readonly dynamicCache = new Map<string, DynamicCacheEntry>();

  async makeSource(
    sourceConfig: SourceConfig,
    config: Config,
    name: string
  ): Promise<FileManagerService> {
    // Remote adapters work on a virtual root; only the local one needs a real directory
    const effectiveConfig: SourceConfig = isLocalStorageSource(sourceConfig)
      ? sourceConfig
      : { ...sourceConfig, root: sourceConfig.root ?? VIRTUAL_ROOT };

    const storage = new FileStorage(createStorageAdapter(effectiveConfig));

    // Create a proxied config that allows source-specific overrides
    const proxiedConfig = createProxiedConfig(config, effectiveConfig);

    // Create FileManagerService with the storage adapter and proxied config
    return new FileManagerService(
      effectiveConfig,
      proxiedConfig,
      storage,
      name
    );
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
      this.sources = this.buildSources(this.params.sources);
    } else if (this.params.resolveSources === undefined) {
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

  private buildSources(configs: Record<string, SourceConfig>): SourcesPool {
    const pool: SourcesPool = {};

    for (const sourceConfigName in configs) {
      pool[sourceConfigName] = this.makeSource(
        configs[sourceConfigName]!,
        this,
        sourceConfigName
      );
    }

    return pool;
  }

  /**
   * Run `resolveSources` for the request and return the sources to use for
   * it, building and caching them per tenant id. Returns `null` when no
   * resolver is configured or the resolver declined (static sources apply).
   */
  async resolveRequestSources(req: Request): Promise<SourcesPool | null> {
    const resolver = this.params.resolveSources;

    if (resolver === undefined) {
      return null;
    }

    const resolved = await resolver(req);

    if (resolved == null) {
      return null;
    }

    const now = Date.now();
    const cached = this.dynamicCache.get(resolved.id);

    if (cached !== undefined && cached.expiresAt > now) {
      // Refresh LRU position
      this.dynamicCache.delete(resolved.id);
      this.dynamicCache.set(resolved.id, cached);
      return cached.sources;
    }

    const cacheOptions = this.params.dynamicSourcesCache;
    const ttlMs = cacheOptions?.ttlMs ?? DEFAULT_DYNAMIC_CACHE_TTL_MS;
    const max = cacheOptions?.max ?? DEFAULT_DYNAMIC_CACHE_MAX;

    const sources = this.buildSources(resolved.sources);

    this.dynamicCache.delete(resolved.id);
    this.dynamicCache.set(resolved.id, { expiresAt: now + ttlMs, sources });

    for (const [id, entry] of this.dynamicCache) {
      if (this.dynamicCache.size <= max && entry.expiresAt > now) {
        continue;
      }

      if (id !== resolved.id) {
        this.dynamicCache.delete(id);
      }
    }

    return sources;
  }

  /** Drop every cached tenant (e.g. after credentials changed). */
  clearDynamicSources(): void {
    this.dynamicCache.clear();
  }

  async getSources(options: {
    source?: string;
    action: string;
  }): Promise<FileManagerService[]> {
    // Wait for access control to be initialized
    await this.accessInitialized;

    const pool = requestStorage.getStore()?.sources ?? this.sources;

    let sources = await Promise.all(Object.values(pool));
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
