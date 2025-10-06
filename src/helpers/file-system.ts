import fs from 'fs/promises';
import path from 'path';
import type { FileItem } from '../types';

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
  withFolders = false,
  imageExtensions: string[] = []
): Promise<FileItem[]> {
  try {
    const entries = await fs.readdir(dirPath);
    const items: FileItem[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const stats = await fs.stat(fullPath);
      const isDir = stats.isDirectory();

      // Skip folders if withFolders is false
      if (isDir && !withFolders) {
        continue;
      }

      const item: FileItem = {
        file: entry,
        name: entry,
        type: isDir ? 'folder' : 'file',
        size: isDir ? undefined : stats.size,
        changed: stats.mtime.toISOString(),
        isImage: isDir ? undefined : isImageFile(entry, imageExtensions)
      };

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
