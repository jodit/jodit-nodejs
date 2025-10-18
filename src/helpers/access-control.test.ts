import { AccessControl, DEFAULT_RULES } from './access-control';
import type { AccessControlRule } from '../types';

describe('AccessControl', () => {
  describe('DEFAULT_RULES', () => {
    it('should have all permissions set to true by default', () => {
      expect(DEFAULT_RULES.FILES).toBe(true);
      expect(DEFAULT_RULES.FILE_MOVE).toBe(true);
      expect(DEFAULT_RULES.FILE_UPLOAD).toBe(true);
      expect(DEFAULT_RULES.FILE_UPLOAD_REMOTE).toBe(true);
      expect(DEFAULT_RULES.FILE_REMOVE).toBe(true);
      expect(DEFAULT_RULES.FILE_RENAME).toBe(true);
      expect(DEFAULT_RULES.FILE_DOWNLOAD).toBe(true);
      expect(DEFAULT_RULES.FOLDERS).toBe(true);
      expect(DEFAULT_RULES.FOLDER_MOVE).toBe(true);
      expect(DEFAULT_RULES.FOLDER_CREATE).toBe(true);
      expect(DEFAULT_RULES.FOLDER_REMOVE).toBe(true);
      expect(DEFAULT_RULES.FOLDER_RENAME).toBe(true);
      expect(DEFAULT_RULES.FOLDER_TREE).toBe(true);
      expect(DEFAULT_RULES.IMAGE_RESIZE).toBe(true);
      expect(DEFAULT_RULES.IMAGE_CROP).toBe(true);
      expect(DEFAULT_RULES.GENERATE_PDF).toBe(true);
      expect(DEFAULT_RULES.GENERATE_DOCX).toBe(true);
    });

    it('should have wildcard role and extensions', () => {
      expect(DEFAULT_RULES.role).toBe('*');
      expect(DEFAULT_RULES.extensions).toBe('*');
    });

    it('should have root path', () => {
      expect(DEFAULT_RULES.path).toBe('/');
    });
  });

  describe('constructor', () => {
    it('should create instance with empty access list', () => {
      const ac = new AccessControl([]);
      expect(ac).toBeInstanceOf(AccessControl);
    });

    it('should create instance with access list', () => {
      const rules: AccessControlRule[] = [
        {
          role: 'admin',
          FILES: true
        }
      ];
      const ac = new AccessControl(rules);
      expect(ac).toBeInstanceOf(AccessControl);
    });
  });

  describe('setAccessList', () => {
    it('should update access list', async () => {
      const ac = new AccessControl([]);
      const newRules: AccessControlRule[] = [
        {
          role: 'admin',
          FILES: false
        }
      ];
      ac.setAccessList(newRules);

      // Verify by checking permission
      expect(await ac.isAllow('admin', 'FILES', '/', '*')).toBe(false);
    });
  });

  describe('isAllow', () => {
    describe('basic permission checks', () => {
      it('should allow action when explicitly set to true', async () => {
        const ac = new AccessControl([
          {
            role: 'user',
            FILES: true
          }
        ]);

        expect(await ac.isAllow('user', 'FILES', '/', '*')).toBe(true);
      });

      it('should deny action when explicitly set to false', async () => {
        const ac = new AccessControl([
          {
            role: 'user',
            FILES: false
          }
        ]);

        expect(await ac.isAllow('user', 'FILES', '/', '*')).toBe(false);
      });

      it('should use default rule when no matching rule found', async () => {
        const ac = new AccessControl([]);
        expect(await ac.isAllow('any-role', 'FILES', '/', '*')).toBe(true);
      });

      it('should normalize action names to constant case', async () => {
        const ac = new AccessControl([
          {
            role: 'user',
            FILE_UPLOAD: false
          }
        ]);

        expect(await ac.isAllow('user', 'fileUpload', '/', '*')).toBe(false);
        expect(await ac.isAllow('user', 'file-upload', '/', '*')).toBe(false);
        expect(await ac.isAllow('user', 'FILE_UPLOAD', '/', '*')).toBe(false);
      });
    });

    describe('role matching', () => {
      it('should match exact role', async () => {
        const ac = new AccessControl([
          {
            role: 'admin',
            FILES: false
          }
        ]);

        expect(await ac.isAllow('admin', 'FILES', '/', '*')).toBe(false);
        expect(await ac.isAllow('user', 'FILES', '/', '*')).toBe(true); // Uses default
      });

      it('should match wildcard role', async () => {
        const ac = new AccessControl([
          {
            role: '*',
            FILES: false
          }
        ]);

        expect(await ac.isAllow('admin', 'FILES', '/', '*')).toBe(false);
        expect(await ac.isAllow('user', 'FILES', '/', '*')).toBe(false);
        expect(await ac.isAllow('guest', 'FILES', '/', '*')).toBe(false);
      });

      it('should skip rule when role does not match', async () => {
        const ac = new AccessControl([
          {
            role: 'admin',
            FILES: false
          },
          {
            role: 'user',
            FILES: true
          }
        ]);

        expect(await ac.isAllow('user', 'FILES', '/', '*')).toBe(true);
      });
    });

    describe('path matching', () => {
      it('should match exact path', async () => {
        const ac = new AccessControl([
          {
            role: 'user',
            path: '/private',
            FILES: false
          }
        ]);

        expect(await ac.isAllow('user', 'FILES', '/private', '*')).toBe(false);
        expect(await ac.isAllow('user', 'FILES', '/public', '*')).toBe(true);
      });

      it('should match path prefix', async () => {
        const ac = new AccessControl([
          {
            role: 'user',
            path: '/private',
            FILES: false
          }
        ]);

        expect(
          await ac.isAllow('user', 'FILES', '/private/folder/file.txt', '*')
        ).toBe(false);
      });

      it('should normalize paths with backslashes', async () => {
        const ac = new AccessControl([
          {
            role: 'user',
            path: '/private\\subfolder',
            FILES: false
          }
        ]);

        expect(
          await ac.isAllow('user', 'FILES', '/private/subfolder/file.txt', '*')
        ).toBe(false);
      });

      it('should normalize paths with multiple slashes', async () => {
        const ac = new AccessControl([
          {
            role: 'user',
            path: '/private///subfolder',
            FILES: false
          }
        ]);

        expect(
          await ac.isAllow('user', 'FILES', '/private/subfolder/file.txt', '*')
        ).toBe(false);
      });

      it('should skip rule when path does not match', async () => {
        const ac = new AccessControl([
          {
            role: 'user',
            path: '/admin',
            FILES: false
          }
        ]);

        expect(await ac.isAllow('user', 'FILES', '/public', '*')).toBe(true);
      });
    });

    describe('extension matching', () => {
      it('should match single extension as string', async () => {
        const ac = new AccessControl([
          {
            role: 'user',
            extensions: 'jpg',
            FILE_REMOVE: false
          }
        ]);

        expect(await ac.isAllow('user', 'FILE_REMOVE', '/', 'jpg')).toBe(false);
        expect(await ac.isAllow('user', 'FILE_REMOVE', '/', 'png')).toBe(true);
      });

      it('should match multiple extensions as comma-separated string', async () => {
        const ac = new AccessControl([
          {
            role: 'user',
            extensions: 'jpg, png, gif',
            FILE_REMOVE: false
          }
        ]);

        expect(await ac.isAllow('user', 'FILE_REMOVE', '/', 'jpg')).toBe(false);
        expect(await ac.isAllow('user', 'FILE_REMOVE', '/', 'png')).toBe(false);
        expect(await ac.isAllow('user', 'FILE_REMOVE', '/', 'gif')).toBe(false);
        expect(await ac.isAllow('user', 'FILE_REMOVE', '/', 'txt')).toBe(true);
      });

      it('should match extensions as array', async () => {
        const ac = new AccessControl([
          {
            role: 'user',
            extensions: ['jpg', 'png'],
            FILE_REMOVE: false
          }
        ]);

        expect(await ac.isAllow('user', 'FILE_REMOVE', '/', 'jpg')).toBe(false);
        expect(await ac.isAllow('user', 'FILE_REMOVE', '/', 'png')).toBe(false);
        expect(await ac.isAllow('user', 'FILE_REMOVE', '/', 'txt')).toBe(true);
      });

      it('should match extensions case-insensitively', async () => {
        const ac = new AccessControl([
          {
            role: 'user',
            extensions: ['JPG', 'png'],
            FILE_REMOVE: false
          }
        ]);

        expect(await ac.isAllow('user', 'FILE_REMOVE', '/', 'jpg')).toBe(false);
        expect(await ac.isAllow('user', 'FILE_REMOVE', '/', 'JPG')).toBe(false);
        expect(await ac.isAllow('user', 'FILE_REMOVE', '/', 'PNG')).toBe(false);
        expect(await ac.isAllow('user', 'FILE_REMOVE', '/', 'png')).toBe(false);
      });

      it('should match wildcard extension', async () => {
        const ac = new AccessControl([
          {
            role: 'user',
            extensions: '*',
            FILE_REMOVE: false
          }
        ]);

        expect(await ac.isAllow('user', 'FILE_REMOVE', '/', 'jpg')).toBe(false);
        expect(await ac.isAllow('user', 'FILE_REMOVE', '/', 'txt')).toBe(false);
        expect(await ac.isAllow('user', 'FILE_REMOVE', '/', 'pdf')).toBe(false);
      });

      it('should handle extensions as function', async () => {
        const extensionsFn = (
          action: string,
          rule: unknown,
          path: string,
          fileExtension: string
        ): string[] => {
          // Only allow rule to apply for jpg files
          return fileExtension === 'jpg' ? ['JPG'] : [];
        };

        const ac = new AccessControl([
          {
            role: 'user',
            extensions: extensionsFn,
            FILE_REMOVE: false
          }
        ]);

        expect(await ac.isAllow('user', 'FILE_REMOVE', '/', 'jpg')).toBe(false);
        // For png, function returns empty array, so rule doesn't match, uses default (true)
        expect(await ac.isAllow('user', 'FILE_REMOVE', '/', 'png')).toBe(true);
      });

      it('should skip rule when extension does not match', async () => {
        const ac = new AccessControl([
          {
            role: 'user',
            extensions: ['jpg'],
            FILE_REMOVE: false
          }
        ]);

        expect(await ac.isAllow('user', 'FILE_REMOVE', '/', 'txt')).toBe(true);
      });
    });

    describe('action value as function', () => {
      it('should call function and use returned boolean', async () => {
        const ac = new AccessControl([
          {
            role: 'user',
            FILES: (action, rule, path): boolean => {
              return path.includes('allowed');
            }
          }
        ]);

        expect(await ac.isAllow('user', 'FILES', '/allowed/path', '*')).toBe(
          true
        );
        expect(await ac.isAllow('user', 'FILES', '/denied/path', '*')).toBe(
          false
        );
      });

      it('should treat non-boolean function result as true', async () => {
        const ac = new AccessControl([
          {
            role: 'user',
            FILES: (): boolean => {
              return 'some string' as unknown as boolean;
            }
          }
        ]);

        expect(await ac.isAllow('user', 'FILES', '/', '*')).toBe(true);
      });
    });

    describe('rule priority', () => {
      it('should use last matching rule', async () => {
        const ac = new AccessControl([
          {
            role: 'user',
            FILES: true
          },
          {
            role: 'user',
            FILES: false
          }
        ]);

        expect(await ac.isAllow('user', 'FILES', '/', '*')).toBe(false);
      });

      it('should process rules in order with more specific rules later', async () => {
        const ac = new AccessControl([
          {
            role: 'user',
            FILES: true
          },
          {
            role: 'user',
            path: '/private',
            FILES: false
          }
        ]);

        expect(await ac.isAllow('user', 'FILES', '/public', '*')).toBe(true);
        expect(await ac.isAllow('user', 'FILES', '/private', '*')).toBe(false);
      });
    });

    describe('complex scenarios', () => {
      it('should handle multiple conditions (role + path + extension)', async () => {
        const ac = new AccessControl([
          {
            role: 'user',
            path: '/uploads',
            extensions: ['jpg', 'png'],
            FILE_UPLOAD: false
          }
        ]);

        // All conditions match - should deny
        expect(
          await ac.isAllow('user', 'FILE_UPLOAD', '/uploads/image.jpg', 'jpg')
        ).toBe(false);

        // Different role - should allow (use default)
        expect(
          await ac.isAllow('admin', 'FILE_UPLOAD', '/uploads/image.jpg', 'jpg')
        ).toBe(true);

        // Different path - should allow (use default)
        expect(
          await ac.isAllow('user', 'FILE_UPLOAD', '/public/image.jpg', 'jpg')
        ).toBe(true);

        // Different extension - should allow (use default)
        expect(
          await ac.isAllow('user', 'FILE_UPLOAD', '/uploads/file.txt', 'txt')
        ).toBe(true);
      });

      it('should handle overlapping rules with different specificity', async () => {
        const ac = new AccessControl([
          {
            role: '*',
            FILES: false
          },
          {
            role: 'admin',
            FILES: true
          }
        ]);

        expect(await ac.isAllow('guest', 'FILES', '/', '*')).toBe(false);
        expect(await ac.isAllow('admin', 'FILES', '/', '*')).toBe(true);
      });
    });
  });

  describe('checkPermission', () => {
    it('should return true when permission is allowed', async () => {
      const ac = new AccessControl([
        {
          role: 'user',
          FILES: true
        }
      ]);

      await expect(ac.checkPermission('user', 'FILES', '/', '*')).resolves.toBe(
        true
      );
    });

    it('should throw Boom.forbidden when permission is denied', async () => {
      const ac = new AccessControl([
        {
          role: 'user',
          FILES: false
        }
      ]);

      await expect(
        ac.checkPermission('user', 'FILES', '/', '*')
      ).rejects.toThrow('Access denied');
    });

    it('should use default values for optional parameters', async () => {
      const ac = new AccessControl([
        {
          role: 'user',
          FILES: true
        }
      ]);

      await expect(ac.checkPermission('user', 'FILES')).resolves.toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty access list', async () => {
      const ac = new AccessControl([]);
      expect(await ac.isAllow('any-role', 'FILES', '/', '*')).toBe(true);
    });

    it('should handle rule without action specified', async () => {
      const ac = new AccessControl([
        {
          role: 'user'
        } as AccessControlRule
      ]);

      // Should use default rule
      expect(await ac.isAllow('user', 'FILES', '/', '*')).toBe(true);
    });

    it('should handle empty extension string', async () => {
      const ac = new AccessControl([
        {
          role: 'user',
          extensions: '',
          FILE_REMOVE: false
        }
      ]);

      // Empty string splits to empty array, so nothing matches
      expect(await ac.isAllow('user', 'FILE_REMOVE', '/', 'jpg')).toBe(true);
    });

    it('should handle undefined role in rule', async () => {
      const ac = new AccessControl([
        {
          FILES: false
        } as AccessControlRule
      ]);

      // Rule without role should match any role
      expect(await ac.isAllow('any-role', 'FILES', '/', '*')).toBe(false);
    });

    it('should handle undefined path in rule', async () => {
      const ac = new AccessControl([
        {
          role: 'user',
          FILES: false
        }
      ]);

      // Rule without path should match any path
      expect(await ac.isAllow('user', 'FILES', '/any/path', '*')).toBe(false);
    });

    it('should handle undefined extensions in rule', async () => {
      const ac = new AccessControl([
        {
          role: 'user',
          FILE_REMOVE: false
        }
      ]);

      // Rule without extensions should match any extension
      expect(await ac.isAllow('user', 'FILE_REMOVE', '/', 'any')).toBe(false);
    });
  });
});
