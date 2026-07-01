import path from 'node:path';
import Boom from '@hapi/boom';
import bytes from 'bytes';
import { Readable } from 'node:stream';
import sanitize from 'sanitize-filename';
import type { FileManagerContext } from './types';
import { fetchGuardedAgainstSsrf } from '../../helpers/ssrf';

/**
 * Upload a file from remote URL
 */
export async function uploadFileFromUrl(
  ctx: FileManagerContext,
  url: string,
  relativePath?: string
): Promise<{
  baseurl: string;
  newfilename: string;
  isImage: boolean;
}> {
  const dirPath = await ctx.getPath(relativePath);
  const root = await ctx.getRoot();

  await ctx.access.checkPermission(
    await ctx.config.getUserRole(),
    'FILE_UPLOAD',
    dirPath
  );

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw Boom.badRequest('Invalid URL');
  }

  // Extract filename from URL
  const urlPath = parsedUrl.pathname;
  const fileName = path.basename(urlPath) || 'downloaded-file';
  const safeFileName = sanitize(fileName, { replacement: '_' });

  if (!safeFileName) {
    throw Boom.badRequest('Cannot extract valid filename from URL');
  }

  // Download file. Redirects are followed manually and every hop is re-checked
  // against the SSRF guard (unless private hosts are explicitly allowed).
  let fileContent: Buffer;
  try {
    const response = await fetchGuardedAgainstSsrf(
      url,
      !ctx.config.params.allowPrivateNetworkUploads
    );

    if (!response.ok) {
      throw Boom.badRequest(`File was not loaded: HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    fileContent = Buffer.from(arrayBuffer);
  } catch (err) {
    if (Boom.isBoom(err)) {
      throw err;
    }
    throw Boom.badRequest(`File was not loaded: ${(err as Error).message}`);
  }

  // Determine target path
  let targetPath = path.join(dirPath, safeFileName);
  let targetRelative = targetPath.replace(root, '').replace(/^\//, '');

  // Handle file name conflicts based on strategy
  if (await ctx.storage.fileExists(targetRelative, {}).catch(() => false)) {
    const strategy = ctx.config.params.saveSameFileNameStrategy || 'addNumber';

    switch (strategy) {
      case 'error':
        throw Boom.badRequest(`File ${safeFileName} already exists`);

      case 'replace':
        // Keep the same name, will overwrite
        break;

      case 'addNumber':
      default: {
        const ext = ctx.getExtension(safeFileName);
        const baseName = path.basename(safeFileName, '.' + ext);
        let counter = 1;

        do {
          const newFileName = ext
            ? `${baseName}-${counter}.${ext}`
            : `${baseName}-${counter}`;
          targetPath = path.join(dirPath, newFileName);
          targetRelative = targetPath.replace(root, '').replace(/^\//, '');
          counter++;
        } while (
          await ctx.storage.fileExists(targetRelative, {}).catch(() => false)
        );
        break;
      }
    }
  }

  // Write file to storage
  await ctx.storage.write(targetRelative, Readable.from(fileContent), {});

  try {
    const stats = await ctx.storage.stat(targetRelative, {});

    if (!stats.isFile) {
      await ctx.storage.deleteFile(targetRelative, {});
      throw Boom.badRequest('It is not a file!');
    }

    // Check if file is safe
    if (!ctx.isSafeFile(stats)) {
      await ctx.storage.deleteFile(targetRelative, {});
      throw Boom.forbidden('File type is not in white list');
    }

    // Check file size
    const maxSize = ctx.config.params.maxUploadFileSize;
    if (maxSize && (stats.size ?? 0) > (bytes(maxSize) ?? 0)) {
      await ctx.storage.deleteFile(targetRelative, {});
      throw Boom.forbidden('File size exceeds the allowable');
    }

    // Check permissions with extension
    await ctx.access.checkPermission(
      await ctx.config.getUserRole(),
      'FILE_UPLOAD',
      root,
      ctx.getExtension(targetPath)
    );

    // Return result
    return {
      baseurl: ctx.sourceConfig.baseurl,
      newfilename: path.basename(targetPath),
      isImage: ctx.isImage(stats)
    };
  } catch (e) {
    // Remove file on any error during validation
    await ctx.storage.deleteFile(targetRelative, {}).catch(() => {});
    throw e;
  }
}
