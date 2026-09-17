import Boom from '@hapi/boom';
import type { StorageAdapter } from '@flystorage/file-storage';
import { LocalStorageAdapter } from '@flystorage/local-fs';
import type { SourceConfig } from '../types';
import { S3StorageAdapter } from './s3';

/**
 * Builds a storage adapter for a source. Registered under a name that the
 * source refers to with `storageAdapter: '<name>'`.
 */
export type StorageAdapterFactory = (
  sourceConfig: SourceConfig
) => StorageAdapter;

const LOCAL_ADAPTER = 'local';

const registry = new Map<string, StorageAdapterFactory>();

/**
 * Register (or replace) a named storage adapter factory.
 *
 * @example
 * registerStorageAdapter('azure', source => new AzureBlobStorageAdapter(...));
 * // then in config: sources.docs.storageAdapter = 'azure'
 */
export function registerStorageAdapter(
  name: string,
  factory: StorageAdapterFactory
): void {
  registry.set(name, factory);
}

/**
 * Names of every registered adapter (`local` and `s3` are built in).
 */
export function getRegisteredStorageAdapters(): string[] {
  return Array.from(registry.keys());
}

/**
 * Whether the source is backed by the local filesystem. Every other adapter
 * (built-in `s3`, registered names, adapter instances) works on a virtual
 * root: paths are still validated against `root`, but the filesystem is
 * never consulted.
 */
export function isLocalStorageSource(sourceConfig: SourceConfig): boolean {
  return (
    sourceConfig.storageAdapter === undefined ||
    sourceConfig.storageAdapter === LOCAL_ADAPTER
  );
}

/**
 * Resolve the storage adapter for a source: a registered name, or an
 * adapter instance passed straight through.
 */
export function createStorageAdapter(
  sourceConfig: SourceConfig
): StorageAdapter {
  const adapter = sourceConfig.storageAdapter ?? LOCAL_ADAPTER;

  if (typeof adapter !== 'string') {
    return adapter;
  }

  const factory = registry.get(adapter);

  if (factory === undefined) {
    throw Boom.badRequest(
      `Unknown storage adapter "${adapter}" for source "${sourceConfig.name}". ` +
        `Registered adapters: ${getRegisteredStorageAdapters().join(', ')}`
    );
  }

  return factory(sourceConfig);
}

registerStorageAdapter(LOCAL_ADAPTER, sourceConfig => {
  if (!sourceConfig.root) {
    throw Boom.badRequest(
      `Source "${sourceConfig.name}" uses the local filesystem and needs a "root" directory`
    );
  }

  return new LocalStorageAdapter(sourceConfig.root);
});

registerStorageAdapter('s3', sourceConfig => {
  if (sourceConfig.s3 === undefined) {
    throw Boom.badRequest(
      `Source "${sourceConfig.name}" uses the s3 adapter and needs an "s3" options block`
    );
  }

  return new S3StorageAdapter(sourceConfig.s3);
});
