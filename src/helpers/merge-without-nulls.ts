export function mergeWithoutNulls<T>(obj1: T, obj2: Partial<T>): T {
  const result: T = { ...obj1 };

  for (const key in obj2) {
    if (obj2[key] !== null && obj2[key] !== undefined) {
      if (
        typeof obj2[key] === 'object' &&
        !Array.isArray(obj2[key]) &&
        obj2[key] !== null &&
        typeof result[key] === 'object' &&
        !Array.isArray(result[key]) &&
        result[key] !== null
      ) {
        // Deep merge for nested objects
        result[key] = mergeWithoutNulls(result[key], obj2[key]);
      } else {
        result[key] = obj2[key] as T[Extract<keyof T, string>];
      }
    }
  }
  return result;
}
