import path from 'node:path';
import type { AppConfig } from '../types';

/**
 * Collect the directories whose location should never appear in a response.
 *
 * Storage errors come straight from the operating system and name absolute
 * paths (`rename '/srv/www/files/a' -> …`), which tells a stranger where the
 * files live and what the directory layout above them looks like.
 */
export function collectRoots(params: AppConfig | undefined): string[] {
  const roots = new Set<string>();

  const add = (value: string | undefined): void => {
    if (value !== undefined && value !== '') {
      roots.add(path.resolve(value));
    }
  };

  add(params?.root);
  add(process.cwd());

  for (const source of Object.values(params?.sources ?? {})) {
    add(source?.root);
  }

  // Longest first, so a nested root is replaced before its parent.
  return [...roots].sort((a, b) => b.length - a.length);
}

/**
 * Replace absolute locations in a message with paths relative to the source.
 */
export function redactPaths(message: string, roots: string[]): string {
  let result = message;

  for (const root of roots) {
    result = result.split(root).join('');
  }

  // A path that was exactly the root leaves empty quotes behind; show it as
  // the source root instead, and collapse any doubled separator.
  return result.replace(/''/g, "'/'").replace(/\/{2,}/g, '/');
}
