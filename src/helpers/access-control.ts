import type {
  AccessControlConfig,
  AccessControlRule,
  IAccessControl
} from '../types';
import * as changeCase from 'change-case';
import Boom from '@hapi/boom';

export const DEFAULT_RULES = {
  role: '*',

  extensions: '*',
  path: '/',

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
  IMAGE_SAVE: true,
  IMAGE_LOAD: true,

  GENERATE_PDF: true,
  GENERATE_DOCX: true
};

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

export class AccessControl implements IAccessControl {
  private accessList: AccessControlConfig;

  constructor(accessList: AccessControlConfig) {
    this.accessList = accessList;
  }

  setAccessList(list: AccessControlConfig): void {
    this.accessList = list;
  }

  private async getAccessList(): Promise<AccessControlRule[]> {
    if (typeof this.accessList === 'function') {
      return await this.accessList();
    }
    return this.accessList;
  }

  async checkPermission(
    role: string,
    action: string,
    path: string = '/',
    fileExtension: string = '*'
  ): Promise<boolean> {
    if (!(await this.isAllow(role, action, path, fileExtension))) {
      throw Boom.forbidden('Access denied');
    }
    return true;
  }

  async isAllow(
    role: string,
    action: string,
    path: string = '/',
    fileExtension: string = '*'
  ): Promise<boolean> {
    const normalizedAction = changeCase.constantCase(
      action
    ) as keyof typeof DEFAULT_RULES;
    let allow: boolean | null = null;

    const accessList = await this.getAccessList();

    for (const rule of accessList) {
      // Check role
      if (rule.role !== undefined && rule.role !== '*' && rule.role !== role) {
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
        if (
          !allowExtensions.includes('*') &&
          !allowExtensions.includes(upperExt)
        ) {
          continue;
        }
      }

      // Check action permission
      if (rule[normalizedAction] !== undefined) {
        const actionValue = rule[normalizedAction];

        if (typeof actionValue === 'function') {
          const result = actionValue(
            normalizedAction,
            rule,
            path,
            fileExtension
          );
          allow = typeof result === 'boolean' ? result : true;
        } else {
          allow = typeof actionValue === 'boolean' ? actionValue : true;
        }
      }
    }

    // Use default rule if no explicit rule found
    allow ??= (DEFAULT_RULES[normalizedAction] as boolean) ?? true;

    return allow === true;
  }
}
