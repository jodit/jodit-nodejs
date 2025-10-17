import type { StatEntry, FileStorage } from '@flystorage/file-storage';
import type { Config } from '../../config/config';
import type { IAccessControl, SourceConfig } from '../../types';

/**
 * Common context passed to all file manager functions
 */
export interface FileManagerContext {
  storage: FileStorage;
  config: Config;
  sourceConfig: SourceConfig;
  access: IAccessControl;
  /**
   * Get root directory for the source
   */
  getRoot: () => Promise<string>;
  /**
   * Get full path for a relative path
   */
  getPath: (relativePath?: string) => Promise<string>;
  /**
   * Get extension from file path or StatEntry
   */
  getExtension: (fileOrPath: string | StatEntry) => string;
  /**
   * Check if file is excluded by config
   */
  isExcluded: (file: StatEntry) => boolean;
  /**
   * Check if file is a valid file type
   */
  isGoodFile: (file: StatEntry) => boolean;
  /**
   * Check if file is safe according to config
   */
  isSafeFile: (file: StatEntry) => boolean;
  /**
   * Check if file is an image
   */
  isImage: (file: StatEntry) => boolean;
  /**
   * Source name
   */
  name: string;
}

/**
 * Internal representation of a file/folder for processing
 */
export interface IItemFile {
  stat: StatEntry;
  name: string;
  size: number;
  mtime: number;
  extension: string;
  isImage: boolean;
}
