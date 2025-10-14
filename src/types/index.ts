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
  excludeDirectoryNames: string[];
  maxFileSize: string;
  maxUploadFileSize: string;
  memoryLimit: string;
  timeoutLimit: number;
  allowCrossOrigin: boolean;
  safeThumbsCountInOneTime: number;
  sourceClassName: string;
  accessControl: AccessControlRule[];
  roleSessionVar: string;
  defaultRole: string;
  allowReplaceSourceFile: boolean;
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
