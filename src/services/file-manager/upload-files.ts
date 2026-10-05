import path from 'node:path';
import fs from 'node:fs';
import Boom from '@hapi/boom';
import bytes from 'bytes';
import { Readable } from 'node:stream';
import sanitize from 'sanitize-filename';
import type { FileManagerContext, IItemFile } from './types';
import { MulterFile } from '../../types';
import { sanitizeUploadBuffer } from '../../helpers/sanitize-upload';

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

  // Paths this call created, as opposed to overwrote. Only these may be
  // removed if something fails later: deleting an overwritten path would take
  // the file that was already there with it.
  const created: string[] = [];

  // Nothing is written until every file in the request has passed. The checks
  // used to run after the write, so a refused upload of `contract.pdf` first
  // replaced the existing `contract.pdf` and then deleted it, which let anyone
  // without upload rights destroy files by name.
  const maxSize = bytes(ctx.config.params.maxUploadFileSize) ?? 0;

  for (const uploadedFile of files) {
    const fileName = sanitize(uploadedFile.originalname, {
      replacement: '_'
    });
    const extension = ctx.getExtension(fileName);

    if (!extension || !ctx.config.params.extensions.includes(extension)) {
      throw Boom.forbidden('File type is not in white list');
    }

    const { size } = await fs.promises.stat(uploadedFile.path);

    if (maxSize > 0 && size > maxSize) {
      throw Boom.forbidden('File size exceeds the allowable');
    }

    await ctx.access.checkPermission(
      await ctx.config.getUserRole(),
      'FILE_UPLOAD',
      root,
      extension
    );
  }

  try {
    for (const uploadedFile of files) {
      // Make filename safe
      const fileName = sanitize(uploadedFile.originalname, {
        replacement: '_'
      });
      let targetPath = path.join(dirPath, fileName);
      let overwrites = false;

      // Handle file name conflicts based on strategy
      if (await ctx.storage.fileExists(path.relative(root, targetPath), {})) {
        const strategy =
          ctx.config.params.saveSameFileNameStrategy || 'addNumber';

        switch (strategy) {
          case 'error':
            throw Boom.badRequest(`File ${fileName} already exists`);

          case 'replace':
            // Keep the same name, will overwrite
            overwrites = true;
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
              await ctx.storage.fileExists(path.relative(root, targetPath), {})
            );
            break;
          }
        }
      }

      // Read uploaded file and write to storage
      let fileBuffer = await fs.promises.readFile(uploadedFile.path);

      fileBuffer = sanitizeUploadBuffer(
        fileBuffer,
        fileName,
        ctx.config.params.sanitizeSvgUploads
      );

      const relativeTarget = path.relative(root, targetPath);

      await ctx.storage.write(relativeTarget, Readable.from(fileBuffer), {});

      if (!overwrites) {
        created.push(relativeTarget);
      }

      const stat = await ctx.storage.stat(relativeTarget, {});

      if (!stat.isFile) {
        throw Boom.badRequest('It is not a file!');
      }

      output.push({
        stat,
        name: path.basename(targetPath),
        size: stat.size || 0,
        mtime: stat.lastModifiedMs || 0,
        extension: ctx.getExtension(targetPath),
        isImage: ctx.isImage(stat)
      });
    }
  } catch (e) {
    // Roll back only what this call brought into existence.
    for (const relativePath of created) {
      await ctx.storage.deleteFile(relativePath, {}).catch(() => undefined);
    }
    throw e;
  }

  return output;
}
