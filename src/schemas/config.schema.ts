import { z } from 'zod';

// Source configuration schema
export const SourceConfigSchema = z.object({
  title: z.string(),
  root: z.string(),
  baseurl: z.url()
});

// PDF configuration schema
export const PdfConfigSchema = z.object({
  defaultFont: z.string(),
  isRemoteEnabled: z.boolean(),
  fontDir: z.string(),
  fontCache: z.string(),
  tempDir: z.string(),
  chroot: z.string(),
  paper: z.object({
    format: z.string(),
    page_orientation: z.string()
  })
});

// App configuration schema
export const AppConfigSchema = z.object({
  title: z.string().optional(),
  defaultFilesKey: z.string(),
  saveSameFileNameStrategy: z.string(),
  debug: z.boolean(),
  sources: z.record(z.string(), SourceConfigSchema),
  datetimeFormat: z.string(),
  quality: z.number(),
  countInChunk: z.number(),
  defaultSortBy: z.string(),
  defaultPermission: z.number(),
  createThumb: z.boolean(),
  thumbSize: z.number(),
  thumbFolderName: z.string(),
  excludeDirectoryNames: z.array(z.string()),
  maxFileSize: z.string(),
  maxUploadFileSize: z.string(),
  memoryLimit: z.string(),
  timeoutLimit: z.number(),
  allowCrossOrigin: z.boolean(),
  safeThumbsCountInOneTime: z.number(),
  sourceClassName: z.string(),
  accessControl: z.array(z.unknown()),
  roleSessionVar: z.string(),
  defaultRole: z.string(),
  allowReplaceSourceFile: z.boolean(),
  baseurl: z.string(),
  root: z.string(),
  extensions: z.array(z.string()),
  imageExtensions: z.array(z.string()),
  maxImageWidth: z.number(),
  maxImageHeight: z.number(),
  pdf: PdfConfigSchema
});

export type AppConfigSchemaType = z.infer<typeof AppConfigSchema>;
