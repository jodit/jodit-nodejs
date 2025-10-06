import { z } from 'zod';

// Source configuration schema
export const SourceConfigSchema = z.object({
  title: z.string().describe('Display title for the source'),
  root: z.string().describe('Absolute path to the root directory'),
  baseurl: z.url().describe('Base URL for accessing files')
});

// PDF configuration schema
export const PdfConfigSchema = z.object({
  defaultFont: z.string().describe('Default font for PDF generation'),
  isRemoteEnabled: z.boolean().describe('Whether remote resources are allowed'),
  fontDir: z.string().describe('Directory for font files'),
  fontCache: z.string().describe('Directory for font cache'),
  tempDir: z.string().describe('Temporary directory for PDF processing'),
  chroot: z.string().describe('Chroot directory for security'),
  paper: z.object({
    format: z.string().describe('Paper format (e.g., A4, Letter)'),
    page_orientation: z.string().describe('Page orientation (portrait or landscape)')
  }).describe('Paper configuration')
});

// App configuration schema
export const AppConfigSchema = z.object({
  title: z.string().optional().describe('Application title'),
  defaultFilesKey: z.string().describe('Default key for files source'),
  saveSameFileNameStrategy: z.string().describe('Strategy for handling duplicate file names'),
  debug: z.boolean().describe('Enable debug mode'),
  sources: z.record(z.string(), SourceConfigSchema).describe('File sources configuration'),
  datetimeFormat: z.string().describe('Format for datetime display'),
  quality: z.number().describe('Image quality (1-100)'),
  countInChunk: z.number().describe('Number of files to process in one chunk'),
  defaultSortBy: z.string().describe('Default sorting method'),
  defaultPermission: z.number().describe('Default file permissions (octal)'),
  createThumb: z.boolean().describe('Whether to create thumbnails'),
  thumbSize: z.number().describe('Thumbnail size in pixels'),
  thumbFolderName: z.string().describe('Name of the thumbnail folder'),
  excludeDirectoryNames: z.array(z.string()).describe('Directory names to exclude'),
  maxFileSize: z.string().describe('Maximum file size (e.g., "8mb")'),
  maxUploadFileSize: z.string().describe('Maximum upload file size (e.g., "8M")'),
  memoryLimit: z.string().describe('PHP-style memory limit (e.g., "256M")'),
  timeoutLimit: z.number().describe('Request timeout in seconds'),
  allowCrossOrigin: z.boolean().describe('Enable CORS'),
  safeThumbsCountInOneTime: z.number().describe('Safe number of thumbnails to create at once'),
  sourceClassName: z.string().describe('Source class name for custom implementations'),
  accessControl: z.array(z.unknown()).describe('Access control rules'),
  roleSessionVar: z.string().describe('Session variable name for user role'),
  defaultRole: z.string().describe('Default user role'),
  allowReplaceSourceFile: z.boolean().describe('Allow replacing existing files'),
  baseurl: z.string().describe('Base URL for the application'),
  root: z.string().describe('Root directory for files'),
  extensions: z.array(z.string()).describe('Allowed file extensions'),
  imageExtensions: z.array(z.string()).describe('Image file extensions'),
  maxImageWidth: z.number().describe('Maximum image width in pixels'),
  maxImageHeight: z.number().describe('Maximum image height in pixels'),
  pdf: PdfConfigSchema.describe('PDF generation configuration')
});

export type AppConfigSchemaType = z.infer<typeof AppConfigSchema>;
