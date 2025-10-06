import type { AppConfig } from '../types';

export interface AccessControlRule {
  role?: string;
  path?: string;
  extensions?: string | string[] | ((action: string, rule: AccessControlRule, path: string, extension: string) => string[]);
  [action: string]: boolean | string | string[] | ((action: string, rule: AccessControlRule, path: string, extension: string) => string[] | boolean) | undefined;
}

export const DEFAULT_RULES: Record<string, boolean> = {
  FILES: true,
  FILE_MOVE: true,
  FILE_UPLOAD: true,
  FILE_UPLOAD_REMOTE: true,
  FILE_REMOVE: true,
  FILE_RENAME: true,
  FILE_DOWNLOAD: true,
  FOLDERS: true,
  FOLDER_MOVE: true,
  FOLDER_CREATE: true,
  FOLDER_REMOVE: true,
  FOLDER_RENAME: true,
  FOLDER_TREE: true,
  IMAGE_RESIZE: true,
  IMAGE_CROP: true,
  GENERATE_PDF: true,
  GENERATE_DOCX: true
};

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

function upperize(str: string): string {
  // Convert camelCase to SNAKE_CASE
  return str
    .replace(/([A-Z])/g, '_$1')  // Add underscore before capitals
    .toUpperCase()                // Convert to uppercase
    .replace(/^_/, '');           // Remove leading underscore
}

export class AccessControl {
  private accessList: AccessControlRule[] = [];

  constructor(accessList: AccessControlRule[] = []) {
    this.accessList = accessList;
  }

  setAccessList(list: AccessControlRule[]): void {
    this.accessList = list;
  }

  checkPermission(
    role: string,
    action: string,
    path: string = '/',
    fileExtension: string = '*'
  ): boolean {
    if (!this.isAllow(role, action, path, fileExtension)) {
      throw new Error('Access denied');
    }
    return true;
  }

  isAllow(
    role: string,
    action: string,
    path: string = '/',
    fileExtension: string = '*'
  ): boolean {
    const normalizedAction = upperize(action);
    let allow: boolean | null = null;

    for (const rule of this.accessList) {
      // Check role
      if (
        rule.role !== undefined &&
        rule.role !== '*' &&
        rule.role !== role
      ) {
        continue;
      }

      // Check path
      if (rule.path !== undefined) {
        const normalizedPath = normalizePath(path);
        const normalizedRulePath = normalizePath(rule.path);

        if (!normalizedPath.startsWith(normalizedRulePath)) {
          continue;
        }
      }

      // Check extensions
      if (rule.extensions !== undefined) {
        let allowExtensions: string[] = ['*'];

        if (typeof rule.extensions === 'string') {
          allowExtensions = rule.extensions
            .split(/[,\s]+/)
            .map(ext => ext.toUpperCase());
        } else if (Array.isArray(rule.extensions)) {
          allowExtensions = rule.extensions.map(ext => ext.toUpperCase());
        } else if (typeof rule.extensions === 'function') {
          allowExtensions = rule.extensions(
            normalizedAction,
            rule,
            path,
            fileExtension
          );
        }

        const upperExt = fileExtension.toUpperCase();
        if (!allowExtensions.includes('*') && !allowExtensions.includes(upperExt)) {
          continue;
        }
      }

      // Check action permission
      if (rule[normalizedAction] !== undefined) {
        const actionValue = rule[normalizedAction];

        if (typeof actionValue === 'function') {
          const result = actionValue(normalizedAction, rule, path, fileExtension);
          allow = typeof result === 'boolean' ? result : true;
        } else {
          allow = typeof actionValue === 'boolean' ? actionValue : true;
        }
      }
    }

    // Use default rule if no explicit rule found
    allow ??= DEFAULT_RULES[normalizedAction] ?? true;

    return allow === true;
  }
}

export function createAccessControl(config: AppConfig): AccessControl {
  return new AccessControl(config.accessControl as AccessControlRule[]);
}
