import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { ensureDirectory } from './file-system';

/**
 * Generate thumbnail for an image file
 */
export async function generateThumbnail(
  filePath: string,
  thumbPath: string,
  size: number,
  quality: number
): Promise<void> {
  await sharp(filePath)
    .resize(size, size, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality })
    .toFile(thumbPath);
}

/**
 * Generate SVG icon for non-image files
 */
export async function generateFileIcon(
  fileName: string,
  thumbPath: string
): Promise<void> {
  const ext = path.extname(fileName).replace('.', '').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="250" height="250" viewBox="0 0 250 250">
  <rect width="250" height="250" fill="#f0f0f0"/>
  <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="40" font-family="Arial" fill="#333">
    ${ext}
  </text>
</svg>`;

  await fs.writeFile(thumbPath, svg, 'utf-8');
}

/**
 * Check if thumbnail exists
 */
export async function thumbnailExists(thumbPath: string): Promise<boolean> {
  try {
    await fs.access(thumbPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get thumbnail path for a file
 */
export function getThumbnailPath(
  filePath: string,
  thumbFolderName: string
): string {
  const dir = path.dirname(filePath);
  const fileName = path.basename(filePath);
  const ext = path.extname(fileName);
  const baseName = path.basename(fileName, ext);

  return path.join(dir, thumbFolderName, `${baseName}${ext}`);
}

/**
 * Get relative thumbnail path from root
 */
export function getRelativeThumbPath(
  filePath: string,
  sourceRoot: string,
  thumbFolderName: string
): string {
  const dir = path.dirname(filePath);
  const fileName = path.basename(filePath);
  const relativePath = path.relative(sourceRoot, dir);
  const ext = path.extname(fileName);
  const baseName = path.basename(fileName, ext);

  return path.join(relativePath, thumbFolderName, `${baseName}${ext}`);
}

/**
 * Create thumbnail for a file
 */
export async function makeThumb(
  filePath: string,
  sourceRoot: string,
  isImage: boolean,
  thumbFolderName: string,
  thumbSize: number,
  quality: number,
  countThumbs: { count: number },
  safeThumbsCount: number
): Promise<string | undefined> {
  // Check if we've reached the limit
  if (countThumbs.count >= safeThumbsCount) {
    return undefined;
  }

  const thumbPath = getThumbnailPath(filePath, thumbFolderName);
  const thumbDir = path.dirname(thumbPath);

  // Ensure thumbnail directory exists
  await ensureDirectory(thumbDir);

  // Check if thumbnail already exists
  if (await thumbnailExists(thumbPath)) {
    return getRelativeThumbPath(filePath, sourceRoot, thumbFolderName);
  }

  // Generate thumbnail
  try {
    if (isImage) {
      await generateThumbnail(filePath, thumbPath, thumbSize, quality);
    } else {
      // For non-images, generate SVG icon
      const svgPath = thumbPath.replace(path.extname(thumbPath), '.svg');
      await generateFileIcon(path.basename(filePath), svgPath);
      countThumbs.count++;
      return getRelativeThumbPath(filePath, sourceRoot, thumbFolderName).replace(
        path.extname(filePath),
        '.svg'
      );
    }

    countThumbs.count++;
    return getRelativeThumbPath(filePath, sourceRoot, thumbFolderName);
  } catch {
    // If thumbnail generation fails, return undefined
    return undefined;
  }
}
