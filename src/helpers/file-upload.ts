import fs from 'fs/promises';
import path from 'path';
import type { AppConfig } from '../types';

/**
 * Make filename safe by removing dangerous characters
 */
export function makeSafeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Check if file extension is allowed
 */
export function isAllowedExtension(
  filename: string,
  extensions: string[]
): boolean {
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  return extensions.includes(ext);
}

/**
 * Generate unique filename using strategy
 */
export async function generateUniqueFilename(
  targetPath: string,
  filename: string,
  strategy: string
): Promise<string> {
  const exists = await fileExists(targetPath);

  if (!exists) {
    return filename;
  }

  if (strategy === 'replace') {
    return filename;
  }

  // addNumber strategy
  const ext = path.extname(filename);
  const baseName = path.basename(filename, ext);
  const dir = path.dirname(targetPath);

  let counter = 1;
  let newFilename = `${baseName}-${counter}${ext}`;
  let newPath = path.join(dir, newFilename);

  while (await fileExists(newPath)) {
    counter++;
    newFilename = `${baseName}-${counter}${ext}`;
    newPath = path.join(dir, newFilename);
  }

  return newFilename;
}

/**
 * Check if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate uploaded file
 */
export async function validateUploadedFile(
  filePath: string,
  originalName: string,
  config: AppConfig
): Promise<{ valid: boolean; reason?: string }> {
  // Check if extension is allowed
  if (!isAllowedExtension(originalName, config.extensions)) {
    return { valid: false, reason: 'File type is not in white list' };
  }

  // Check file size
  try {
    const stats = await fs.stat(filePath);
    const maxSize = parseFileSize(config.maxUploadFileSize);

    if (stats.size > maxSize) {
      return { valid: false, reason: 'File size exceeds maximum allowed' };
    }
  } catch {
    return { valid: false, reason: 'Could not read file stats' };
  }

  // If it claims to be an image, verify it's actually an image
  const ext = path.extname(originalName).toLowerCase().replace('.', '');
  if (config.imageExtensions.includes(ext)) {
    // TODO: Add actual image validation using sharp
    // For now, we'll trust the extension
  }

  return { valid: true };
}

/**
 * Parse file size string to bytes
 */
export function parseFileSize(sizeStr: string): number {
  const units: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
    k: 1024,
    m: 1024 * 1024,
    g: 1024 * 1024 * 1024
  };

  const match = /^(\d+(?:\.\d+)?)\s*([a-z]+)?$/i.exec(sizeStr.toLowerCase());

  if (match === null) {
    return 8 * 1024 * 1024; // Default 8MB
  }

  const value = parseFloat(match[1] ?? '0');
  const unit = (match[2] ?? 'b').toLowerCase();

  return value * (units[unit] ?? 1);
}

/**
 * Get relative path from root
 */
export function getRelativePath(fullPath: string, root: string): string {
  return path.relative(root, fullPath);
}
