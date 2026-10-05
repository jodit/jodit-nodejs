import type { StorageAdapter, StatEntry } from '@flystorage/file-storage';
import type { Request } from 'express';
import type { S3SourceOptions } from '../storage/s3';

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
  /**
   * Root directory. Required for the local filesystem; for every other
   * adapter it is a virtual root that defaults to `/`.
   */
  root?: string | undefined;
  baseurl: string;
  defaultFilesKey?: string | undefined;
  /**
   * `'local'` (default), `'s3'`, the name of an adapter registered with
   * `registerStorageAdapter()`, or a StorageAdapter instance.
   */
  storageAdapter?: 'local' | 's3' | string | StorageAdapter | undefined;
  /** Options for `storageAdapter: 's3'` */
  s3?: S3SourceOptions | undefined;
  // Allow any AppConfig property to be overridden at source level (except sources)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Sources resolved for one request by `AppConfig.resolveSources`.
 * `id` identifies the tenant: requests with the same id reuse the already
 * built sources until the cache entry expires.
 */
export interface ResolvedSources {
  id: string;
  sources: Record<string, SourceConfig>;
}

export type SourcesResolver = (
  req: Request
) =>
  | Promise<ResolvedSources | null | undefined>
  | ResolvedSources
  | null
  | undefined;

export interface DynamicSourcesCacheOptions {
  /** Maximum number of tenants kept in memory (least recently used are evicted) */
  max: number;
  /** How long resolved sources stay valid, in milliseconds */
  ttlMs: number;
}

export type AllowedOrigins =
  | string[]
  | ((origin: string, req: Request) => boolean | Promise<boolean>);

/**
 * Which resources a document rendered from user-supplied HTML may load.
 *
 * The renderers (`generatePdf`, `generateDocx`) are handed HTML by the client,
 * so every URL inside it is attacker-controlled. By default only public
 * `http`/`https` addresses are fetched: loopback, private and link-local
 * targets such as the cloud metadata service are refused.
 *
 * `allow` and `deny` are URL masks where `*` matches any run of characters,
 * for example `https://cdn.example.com/*`. An empty `allow` means "every
 * public address"; a non-empty one means nothing outside it is loaded.
 */
export interface RemoteResourcesConfig {
  /**
   * Let the renderers reach loopback / private / link-local hosts. Off by
   * default; turn it on only for a trusted internal setup.
   */
  allowPrivateNetwork?: boolean;
  /** URL masks that may be loaded. Empty = any public address. */
  allow?: string[];
  /** URL masks that are never loaded. Checked before `allow`. */
  deny?: string[];
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
  /**
   * Resolve sources per request (multi-tenant mode). When it returns a
   * value, those sources replace the static `sources` for that request.
   */
  resolveSources?: SourcesResolver | undefined;
  /** Cache for sources built by `resolveSources`. Default: 200 tenants, 60 s. */
  dynamicSourcesCache?: DynamicSourcesCacheOptions | undefined;
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
  /**
   * Origins allowed by CORS when `allowCrossOrigin` is on. A list of exact
   * origins or a predicate. Unset = every origin is echoed back.
   */
  allowedOrigins?: AllowedOrigins | undefined;
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
  /**
   * Which resources the `generatePdf` / `generateDocx` renderers may load from
   * the HTML they are given. See {@link RemoteResourcesConfig}.
   */
  remoteResources: RemoteResourcesConfig;
  /**
   * Strip scripting out of uploaded SVG files (event handlers, `script`,
   * `javascript:` links, external references). On by default: an SVG is served
   * as `image/svg+xml` and runs in the origin that serves it.
   */
  sanitizeSvgUploads: boolean;
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
