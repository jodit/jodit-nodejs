import path from 'node:path';
import sharp from 'sharp';
import slugify from 'slugify';
import type { StatEntry } from '@flystorage/file-storage';
import { Readable } from 'node:stream';
import type { FileManagerContext } from './types';
import { isDirectory } from './is-directory';

/**
 * Create or get thumbnail for a file
 */
export async function makeThumb(
  ctx: FileManagerContext,
  file: StatEntry,
  counter: { countThumbs: number } = { countThumbs: 0 }
): Promise<string> {
  const root = await ctx.getRoot();
  const fullPath = path.resolve(root, file.path);
  const fileDirectory = path.dirname(fullPath);

  if (
    !(await isDirectory(
      ctx,
      path.join(fileDirectory, ctx.config.params.thumbFolderName)
    ))
  ) {
    await ctx.storage.createDirectory(
      path.join(
        path.relative(root, fileDirectory),
        ctx.config.params.thumbFolderName
      ),
      {}
    );
  }

  const ext =
    file.isDirectory || !ctx.isImage(file)
      ? 'svg'
      : ctx.getExtension(file.path);

  let thumbName = path.resolve(
    fileDirectory,
    ctx.config.params.thumbFolderName,
    slugify(path.basename(file.path, '.' + ext)) + '.' + ext
  );

  if (await ctx.storage.fileExists(path.relative(root, thumbName), {})) {
    return thumbName;
  }

  if (ctx.getExtension(file.path) === 'svg') {
    return file.path;
  }

  counter.countThumbs++;

  if (ctx.isImage(file)) {
    try {
      const fileBuffer = await ctx.storage.readToBuffer(
        path.relative(root, fullPath),
        {}
      );
      const buffer = await sharp(fileBuffer)
        .resize(ctx.config.params.thumbSize, ctx.config.params.thumbSize, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: ctx.config.params.quality })
        .toBuffer();

      await ctx.storage.write(
        path.relative(root, thumbName),
        Readable.from(buffer),
        {}
      );
    } catch {
      return file.path;
    }
  } else if (ctx.config.params.generateSvgThumbs) {
    const svg = ctx.config.params.svgGenerator!(
      file,
      ctx.config.params.svgThumbWidth,
      ctx.config.params.svgThumbHeight
    );

    await ctx.storage.write(
      path.relative(root, thumbName),
      Readable.from(svg),
      {}
    );
  } else {
    return file.path;
  }

  return thumbName;
}
