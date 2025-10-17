import path from 'node:path';
import fs from 'node:fs';
import Boom from '@hapi/boom';
import bytes from 'bytes';
import { Readable } from 'node:stream';
import sanitize from 'sanitize-filename';
import type { FileManagerContext, IItemFile } from './types';
import { MulterFile } from '../../types';

/**
 * Upload multiple files to storage
 */
export async function uploadFiles(
  ctx: FileManagerContext,
  files: MulterFile[]
): Promise<IItemFile[]> {
  const dirPath = await ctx.getPath();
  const root = await ctx.getRoot();
  const output: IItemFile[] = [];

  try {
    for (const uploadedFile of files) {
      // Make filename safe
      const fileName = sanitize(uploadedFile.originalname, { replacement: '_' });
      let targetPath = path.join(dirPath, fileName);

      // Handle file name conflicts based on strategy
      if (
        await ctx.storage.fileExists(path.relative(root, targetPath), {})
      ) {
        const strategy =
          ctx.config.params.saveSameFileNameStrategy || 'addNumber';

        switch (strategy) {
          case 'error':
            throw Boom.badRequest(`File ${fileName} already exists`);

          case 'replace':
            // Keep the same name, will overwrite
            break;

          case 'addNumber':
          default: {
            const ext = ctx.getExtension(fileName);
            const baseName = path.basename(fileName, '.' + ext);
            let counter = 1;

            do {
              const newFileName = `${baseName}-${counter}.${ext}`;
              targetPath = path.join(dirPath, newFileName);
              counter++;
            } while (
              await ctx.storage.fileExists(
                path.relative(root, targetPath),
                {}
              )
            );
            break;
          }
        }
      }

      // Read uploaded file and write to storage
      const fileBuffer = await fs.promises.readFile(uploadedFile.path);
      await ctx.storage.write(
        path.relative(root, targetPath),
        Readable.from(fileBuffer),
        {}
      );

      try {
        const stat = await ctx.storage.stat(
          path.relative(root, targetPath),
          {}
        );

        if (!stat.isFile) {
          throw Boom.badRequest('It is not a file!');
        }

        // Check if file is safe
        if (!ctx.isSafeFile(stat)) {
          await ctx.storage.deleteFile(path.relative(root, targetPath), {});
          throw Boom.forbidden('File type is not in white list');
        }

        // Check file size
        const maxSize = ctx.config.params.maxUploadFileSize;
        if (maxSize && (stat.size ?? 0) > (bytes(maxSize) ?? 0)) {
          await ctx.storage.deleteFile(path.relative(root, targetPath), {});
          throw Boom.forbidden('File size exceeds the allowable');
        }

        // Check permissions with extension
        await ctx.access.checkPermission(
          await ctx.config.getUserRole(),
          'FILE_UPLOAD',
          root,
          ctx.getExtension(targetPath)
        );

        output.push({
          stat,
          name: path.basename(targetPath),
          size: stat.size || 0,
          mtime: stat.lastModifiedMs || 0,
          extension: ctx.getExtension(targetPath),
          isImage: ctx.isImage(stat)
        });
      } catch (e) {
        await ctx.storage.deleteFile(path.relative(root, targetPath), {});
        throw e;
      }
    }
  } catch (e) {
    // Cleanup all uploaded files on error
    for (const file of output) {
      await ctx.storage.deleteFile(file.stat.path, {});
    }
    throw e;
  }

  return output;
}
