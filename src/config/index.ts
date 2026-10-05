import type { AppConfig } from '../types';
import path from 'path';
import os from 'os';
import { generateIcon } from '../helpers/image';

const tmpDir = os.tmpdir();

export const config: AppConfig = {
  title: '',
  saveSameFileNameStrategy: 'addNumber',
  debug: true,
  defaultFilesKey: 'default',
  sources: {
    default: {
      name: 'default',
      title: process.env.SOURCE_NAME ?? 'Test Files',
      root:
        process.env.SOURCE_ROOT != null
          ? path.resolve(process.env.SOURCE_ROOT)
          : path.resolve(process.cwd(), './files/'),
      baseurl:
        process.env.SOURCE_BASEURL ??
        `http://localhost:${process.env.PORT}/files/`
    }
  },
  // Includes seconds: the file browser uses `changed` as the thumbnail
  // cache-buster, so a minute-only format made two edits within the same
  // minute serve the previous (cached) thumbnail.
  datetimeFormat: 'M/D/YYYY h:mm:ss A',
  quality: 90,
  countInChunk: 1000000,
  defaultSortBy: 'changed-desc',
  defaultPermission: 0o775,
  createThumb: true,
  thumbSize: 250,
  thumbFolderName: '_thumbs',

  generateSvgThumbs: true,
  svgThumbWidth: 100,
  svgThumbHeight: 100,
  svgGenerator: generateIcon,

  excludeDirectoryNames: ['.tmb', '.quarantine'],
  maxFileSize: '8mb',
  maxUploadFileSize: '8mb',
  memoryLimit: '256M',
  timeoutLimit: 60,
  allowCrossOrigin: false,
  onlyPOST: false,
  safeThumbsCountInOneTime: 20,
  sourceClassName: 'FileSystem',
  accessControl: [],
  roleSessionVar: 'JoditUserRole',
  defaultRole: 'guest',
  allowReplaceSourceFile: true,
  allowPrivateNetworkUploads: false,
  remoteResources: {
    allowPrivateNetwork: false,
    allow: [],
    deny: []
  },
  sanitizeSvgUploads: true,
  baseurl: '',
  root: path.join(process.cwd(), './files'),
  // `html`, `htm` and `js` are deliberately absent: uploads are served by a
  // plain web server from `baseurl`, so an uploaded page runs its script in
  // whatever origin serves it. A source that really needs them lists them in
  // its own `extensions`.
  extensions: [
    'jpg',
    'png',
    'gif',
    'jpeg',
    'bmp',
    'ico',
    'jpeg',
    'psd',
    'svg',
    'ttf',
    'tif',
    'ai',
    'txt',
    'css',
    'ini',
    'xml',
    'zip',
    'rar',
    '7z',
    'gz',
    'tar',
    'pps',
    'ppt',
    'pptx',
    'odp',
    'xls',
    'xlsx',
    'csv',
    'doc',
    'docx',
    'pdf',
    'rtf',
    'avi',
    'flv',
    '3gp',
    'mov',
    'mkv',
    'mp4',
    'wmv',
    'webp'
  ],
  imageExtensions: ['jpg', 'png', 'gif', 'jpeg', 'bmp', 'svg', 'ico', 'webp'],
  maxImageWidth: 1900,
  maxImageHeight: 1900,
  pdf: {
    defaultFont: 'serif',
    isRemoteEnabled: true,
    fontDir: tmpDir,
    fontCache: tmpDir,
    tempDir: tmpDir,
    chroot: tmpDir,
    paper: {
      format: 'A4',
      page_orientation: 'portrait'
    }
  }
};
