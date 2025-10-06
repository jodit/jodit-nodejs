import fs from 'fs/promises';
import path from 'path';
import type { FileItem } from '../types';
import { makeThumb } from './thumbnail';

export async function isDirectory(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

export function isImageFile(
  fileName: string,
  imageExtensions: string[]
): boolean {
  const ext = path.extname(fileName).toLowerCase().replace('.', '');
  return imageExtensions.includes(ext);
}

export async function getFileItems(
  dirPath: string,
  sourceRoot: string,
  withFolders = false,
  imageExtensions: string[] = [],
  createThumb = false,
  thumbFolderName = '_thumbs',
  thumbSize = 250,
  quality = 90,
  safeThumbsCountInOneTime = 20
): Promise<FileItem[]> {
  try {
    const entries = await fs.readdir(dirPath);
    const items: FileItem[] = [];
    const countThumbs = { count: 0 };

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const stats = await fs.stat(fullPath);
      const isDir = stats.isDirectory();

      // Skip thumbnail folders
      if (isDir && entry === thumbFolderName) {
        continue;
      }

      // Skip folders if withFolders is false
      if (isDir && !withFolders) {
        continue;
      }

      const isImage = !isDir && isImageFile(entry, imageExtensions);

      const item: FileItem = {
        file: entry,
        name: entry,
        type: isDir ? 'folder' : 'file',
        size: isDir ? undefined : stats.size,
        changed: stats.mtime.toISOString(),
        isImage: isDir ? undefined : isImage
      };

      // Generate thumbnail if needed
      if (!isDir && (createThumb || !isImage)) {
        const thumbPath = await makeThumb(
          fullPath,
          sourceRoot,
          isImage,
          thumbFolderName,
          thumbSize,
          quality,
          countThumbs,
          safeThumbsCountInOneTime
        );

        if (thumbPath !== undefined) {
          item.thumb = thumbPath;
        }
      } else if (isDir) {
        // For folders, always try to create thumbnail
        const thumbPath = await makeThumb(
          fullPath,
          sourceRoot,
          false,
          thumbFolderName,
          thumbSize,
          quality,
          countThumbs,
          safeThumbsCountInOneTime
        );

        if (thumbPath !== undefined) {
          item.thumb = thumbPath;
        }
      }

      items.push(item);
    }

    return items;
  } catch {
    throw new Error(`Failed to read directory: ${dirPath}`);
  }
}

export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}
