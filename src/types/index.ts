import type { StorageAdapter, StatEntry } from '@flystorage/file-storage';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
}

export interface ErrorResponse {
  success: false;
  data: {
    code: number;
    messages: string[];
  };
}

export interface SourceConfig {
  title?: string | undefined;
  name: string;
  root: string;
  baseurl: string;
  defaultFilesKey?: string | undefined;
  storageAdapter?: 'local' | StorageAdapter; // 'local' or custom StorageAdapter instance
  // Allow any AppConfig property to be overridden at source level (except sources)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface PdfConfig {
  defaultFont: string;
  isRemoteEnabled: boolean;
  fontDir: string;
  fontCache: string;
  tempDir: string;
  chroot: string;
  paper: {
    format: string;
    page_orientation: string;
  };
}

export type SvgGenerator = (
  file: StatEntry,
  width: number,
  height: number
) => string;

export interface AccessControlRule {
  role?: string;
  path?: string;
  extensions?:
    | string
    | string[]
    | ((
        action: string,
        rule: AccessControlRule,
        path: string,
        extension: string
      ) => string[]);
  [action: string]:
    | boolean
    | string
    | string[]
    | ((
        action: string,
        rule: AccessControlRule,
        path: string,
        extension: string
      ) => string[] | boolean)
    | undefined;
}

/**
 * Interface for AccessControl implementation
 */
export interface IAccessControl {
  setAccessList(list: AccessControlConfig): void;
  checkPermission(
    role: string,
    action: string,
    path?: string,
    fileExtension?: string
  ): Promise<boolean>;
  isAllow(
    role: string,
    action: string,
    path?: string,
    fileExtension?: string
  ): Promise<boolean>;
}

/**
 * Type for accessControl config option
 * Can be:
 * - Array of rules (static)
 * - Function returning array of rules (sync)
 * - Function returning Promise of array of rules (async)
 */
export type AccessControlConfig =
  | AccessControlRule[]
  | (() => AccessControlRule[])
  | (() => Promise<AccessControlRule[]>);

export interface AppConfig {
  title?: string;
  defaultFilesKey: string;
  saveSameFileNameStrategy: string;
  debug: boolean;
  sources: Record<string, SourceConfig>;
  datetimeFormat: string;
  quality: number;
  countInChunk: number;
  defaultSortBy: string;
  defaultPermission: number;
  createThumb: boolean;
  thumbSize: number;
  thumbFolderName: string;
  generateSvgThumbs: boolean;
  svgThumbWidth: number;
  svgThumbHeight: number;
  svgGenerator?: SvgGenerator;
  excludeDirectoryNames: string[];
  maxFileSize: string;
  maxUploadFileSize: string;
  memoryLimit: string;
  timeoutLimit: number;
  allowCrossOrigin: boolean;
  onlyPOST: boolean;
  safeThumbsCountInOneTime: number;
  sourceClassName: string;
  accessControl: AccessControlConfig;
  accessControlInstance?: IAccessControl;
  roleSessionVar: string;
  defaultRole: string;
  allowReplaceSourceFile: boolean;
  /**
   * Allow `fileUploadRemote` to download from loopback / private / link-local
   * hosts. Off by default (SSRF protection); enable only for trusted internal
   * setups.
   */
  allowPrivateNetworkUploads?: boolean;
  baseurl: string;
  root: string;
  extensions: string[];
  imageExtensions: string[];
  maxImageWidth: number;
  maxImageHeight: number;
  pdf: PdfConfig;
}

export interface FileItem {
  file: string;
  name: string;
  type: 'file' | 'folder';
  size?: number | undefined;
  changed?: string | undefined;
  isImage?: boolean | undefined;
  thumb?: string | undefined;
}

export interface SourceData {
  name: string;
  title: string;
  baseurl: string;
  path: string;
  files: FileItem[];
}

export interface FilesActionResponse {
  code: number;
  sources: SourceData[];
}

export type MulterFile = {
  path: string;
  originalname: string;
};
