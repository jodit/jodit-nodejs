import deepmerge from 'deepmerge';

/**
 * Deep merge two objects, filtering out null and undefined values from obj2
 */
export function mergeWithoutNulls<T extends object>(obj1: T, obj2: Partial<T>): T {
  // Filter out null and undefined values from obj2
  const filtered: Partial<T> = {};

  for (const [key, value] of Object.entries(obj2)) {
    if (value !== null && value !== undefined) {
      (filtered as Record<string, unknown>)[key] = value;
    }
  }

  // Use deepmerge for deep merging
  return deepmerge(obj1, filtered) as T;
}
