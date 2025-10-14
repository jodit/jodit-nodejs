import type { Request } from 'express';
import { mergeWithoutNulls } from './merge-without-nulls';

export class RequestContext {
  data: Record<string, unknown>;

  constructor(req: Request) {
    this.data = mergeWithoutNulls(
      mergeWithoutNulls(req.body, req.query),
      req.params ?? {}
    );
  }

  get source(): string {
    return this.getField('source', '');
  }

  get action(): string {
    return this.getField('action', 'default');
  }

  get role(): string {
    return this.getField('role', 'guest');
  }

  get path(): string {
    return this.getField('path', '/');
  }

  getField<T>(key: string, defaultValue: T): T {
    const parts = key.split('/');
    
    let data = this.data;

    if (parts.length > 0) {
      const queryKey = parts[0] + parts.slice(1).map(p => `[${p}]`).join('');
      if (this.data[queryKey] != null) {
        return this.data[queryKey] as T;
      }
    }

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      if (data[part] == null || typeof data[part] !== 'object') {
        return defaultValue as T;
      }
      data = data[part] as Record<string, unknown>;
    }

    return (data[parts[parts.length - 1]!] as T) ?? defaultValue;
  }
}
