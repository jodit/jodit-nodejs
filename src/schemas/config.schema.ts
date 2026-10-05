import { z } from 'zod';

// S3 adapter options schema
export const S3SourceOptionsSchema = z.object({
  bucket: z.string().min(1).describe('Bucket name'),
  region: z.string().optional().describe('AWS region'),
  endpoint: z
    .url()
    .optional()
    .describe('Custom endpoint for S3-compatible services'),
  forcePathStyle: z
    .boolean()
    .optional()
    .describe('Use path-style URLs (endpoint/bucket/key)'),
  prefix: z.string().optional().describe('Key prefix used as the source root'),
  credentials: z
    .object({
      accessKeyId: z.string().min(1),
      secretAccessKey: z.string().min(1),
      sessionToken: z.string().optional()
    })
    .optional()
    .describe('Static credentials; omit to use the AWS default chain'),
  publicBaseUrl: z
    .url()
    .optional()
    .describe('Base URL for publicUrl(); defaults to the bucket URL'),
  client: z.any().optional().describe('Pre-configured S3Client instance')
});

// Source configuration schema
export const SourceConfigSchema = z
  .object({
    title: z.string().describe('Display title for the source'),
    root: z
      .string()
      .optional()
      .describe(
        'Absolute path to the root directory (required for local storage)'
      ),
    baseurl: z.url().describe('Base URL for accessing files'),
    storageAdapter: z
      .union([z.string(), z.any()])
      .optional()
      .describe(
        'Storage adapter: "local" (default), "s3", a registered name or an adapter instance'
      ),
    s3: S3SourceOptionsSchema.optional().describe(
      'Options for storageAdapter: "s3"'
    )
  })
  .refine(
    source =>
      source.storageAdapter !== undefined && source.storageAdapter !== 'local'
        ? true
        : typeof source.root === 'string' && source.root.length > 0,
    { message: 'root is required for local storage', path: ['root'] }
  )
  .refine(source => source.storageAdapter !== 's3' || source.s3 !== undefined, {
    message: 's3 options are required for storageAdapter "s3"',
    path: ['s3']
  });

// PDF configuration schema
export const PdfConfigSchema = z.object({
  defaultFont: z.string().describe('Default font for PDF generation'),
  isRemoteEnabled: z.boolean().describe('Whether remote resources are allowed'),
  fontDir: z.string().describe('Directory for font files'),
  fontCache: z.string().describe('Directory for font cache'),
  tempDir: z.string().describe('Temporary directory for PDF processing'),
  chroot: z.string().describe('Chroot directory for security'),
  paper: z
    .object({
      format: z.string().describe('Paper format (e.g., A4, Letter)'),
      page_orientation: z
        .string()
        .describe('Page orientation (portrait or landscape)')
    })
    .describe('Paper configuration')
});

// Remote resources policy for the generatePdf / generateDocx renderers
export const RemoteResourcesSchema = z
  .object({
    allowPrivateNetwork: z
      .boolean()
      .optional()
      .describe('Allow loopback / private / link-local targets'),
    allow: z
      .array(z.string())
      .optional()
      .describe('URL masks that may be loaded; empty = any public address'),
    deny: z
      .array(z.string())
      .optional()
      .describe('URL masks that are never loaded')
  })
  .describe('Which resources a rendered document may load');

// Access Control Rule schema
export const AccessControlRuleSchema = z
  .object({
    role: z.string().optional().describe('User role (* for all roles)'),
    path: z.string().optional().describe('Path restriction'),
    extensions: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe('Allowed file extensions')
  })
  .catchall(z.union([z.boolean(), z.function()]))
  .describe('Access control rule with action permissions');

// App configuration schema
export const AppConfigSchema = z.object({
  title: z.string().optional().describe('Application title'),
  defaultFilesKey: z.string().describe('Default key for files source'),
  saveSameFileNameStrategy: z
    .string()
    .describe('Strategy for handling duplicate file names'),
  debug: z.boolean().describe('Enable debug mode'),
  sources: z
    .record(z.string(), SourceConfigSchema)
    .describe('File sources configuration')
    .nullable(),
  resolveSources: z
    .function()
    .optional()
    .describe('Per-request sources resolver (multi-tenant mode)'),
  dynamicSourcesCache: z
    .object({
      max: z.number().int().positive(),
      ttlMs: z.number().int().positive()
    })
    .optional()
    .describe('Cache settings for resolved sources'),
  datetimeFormat: z.string().describe('Format for datetime display'),
  quality: z.number().describe('Image quality (1-100)'),
  countInChunk: z.number().describe('Number of files to process in one chunk'),
  defaultSortBy: z.string().describe('Default sorting method'),
  defaultPermission: z.number().describe('Default file permissions (octal)'),
  createThumb: z.boolean().describe('Whether to create thumbnails'),
  thumbSize: z.number().describe('Thumbnail size in pixels'),
  thumbFolderName: z.string().describe('Name of the thumbnail folder'),
  generateSvgThumbs: z
    .boolean()
    .describe('Whether to generate SVG thumbnails for non-image files'),
  svgThumbWidth: z.number().describe('Width of generated SVG thumbnails'),
  svgThumbHeight: z.number().describe('Height of generated SVG thumbnails'),
  svgGenerator: z
    .function()
    .optional()
    .describe('Custom function to generate SVG thumbnails'),
  excludeDirectoryNames: z
    .array(z.string())
    .describe('Directory names to exclude'),
  maxFileSize: z.string().describe('Maximum file size (e.g., "8mb")'),
  maxUploadFileSize: z
    .string()
    .describe('Maximum upload file size (e.g., "8mb")'),
  memoryLimit: z.string().describe('PHP-style memory limit (e.g., "256M")'),
  timeoutLimit: z.number().describe('Request timeout in seconds'),
  allowCrossOrigin: z.boolean().describe('Enable CORS'),
  allowedOrigins: z
    .union([z.array(z.string()), z.function()])
    .optional()
    .describe('Origins allowed by CORS: a list or a predicate'),
  onlyPOST: z
    .boolean()
    .describe('Only allow POST requests, disable GET endpoints'),
  safeThumbsCountInOneTime: z
    .number()
    .describe('Safe number of thumbnails to create at once'),
  sourceClassName: z
    .string()
    .describe('Source class name for custom implementations'),
  accessControl: z
    .union([z.array(AccessControlRuleSchema), z.function()])
    .describe(
      'Access control rules - can be array, sync function, or async function returning array'
    ),
  accessControlInstance: z
    .any()
    .optional()
    .describe(
      'Custom AccessControl instance implementing IAccessControl interface'
    ),
  roleSessionVar: z.string().describe('Session variable name for user role'),
  defaultRole: z.string().describe('Default user role'),
  allowReplaceSourceFile: z
    .boolean()
    .describe('Allow replacing existing files'),
  allowPrivateNetworkUploads: z
    .boolean()
    .optional()
    .describe('Allow fileUploadRemote to download from private hosts'),
  remoteResources: RemoteResourcesSchema.optional().describe(
    'Resources the generatePdf / generateDocx renderers may load'
  ),
  sanitizeSvgUploads: z
    .boolean()
    .optional()
    .describe('Strip scripting out of uploaded SVG files'),
  baseurl: z.string().describe('Base URL for the application'),
  root: z.string().describe('Root directory for files'),
  extensions: z.array(z.string()).describe('Allowed file extensions'),
  imageExtensions: z.array(z.string()).describe('Image file extensions'),
  maxImageWidth: z.number().describe('Maximum image width in pixels'),
  maxImageHeight: z.number().describe('Maximum image height in pixels'),
  pdf: PdfConfigSchema.describe('PDF generation configuration')
});

export type AppConfigSchemaType = z.infer<typeof AppConfigSchema>;
