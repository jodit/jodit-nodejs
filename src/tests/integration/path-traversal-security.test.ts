/**
 * Path Traversal Security Tests
 *
 * These tests verify protection against path traversal attacks described in:
 * https://nodejsdesignpatterns.com/blog/nodejs-path-traversal-security/
 *
 * Attack vectors tested:
 * 1. startsWith() without trailing separator bypass
 * 2. Traversal via `name` parameter in rename/remove/download
 * 3. Traversal via `newname` parameter in rename
 * 4. Traversal via `from` parameter in move
 * 5. Symlink escape
 * 6. Null byte injection
 * 7. Double-encoded path traversal
 */
import request from 'supertest';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  startTestServer,
  stopTestServer,
  cleanupTestFiles,
  createTestFile,
  createTestDirectories,
  TestServer
} from '../test-server';

const testFilesPath = path.join(process.cwd(), './files/test');
const testEvilPath = path.join(process.cwd(), './files/test-evil');

async function cleanupAll(): Promise<void> {
  await cleanupTestFiles();
  try {
    await fs.rm(testEvilPath, { recursive: true, force: true });
  } catch {
    // ignore
  }
  try {
    await fs.rm('/tmp/jodit-security-test-secret', {
      recursive: true,
      force: true
    });
  } catch {
    // ignore
  }
}

describe('Path Traversal Security', () => {
  let testServer: TestServer | null = null;

  beforeAll(async () => {
    testServer = await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer(testServer!);
    await cleanupAll();
  });

  beforeEach(async () => {
    await cleanupAll();
    await createTestDirectories();
  });

  afterEach(async () => {
    await cleanupAll();
  });

  // =========================================================================
  // 1. startsWith() without trailing separator bypass
  //
  // If root is "/path/to/files/test", then "/path/to/files/test-evil"
  // passes `startsWith("/path/to/files/test")` check.
  // Attack vector: path=../test-evil
  // =========================================================================
  describe('startsWith without separator bypass', () => {
    it('should reject path that matches root prefix but is a different directory (folders)', async () => {
      // Create sibling directory "test-evil" alongside "test"
      await fs.mkdir(testEvilPath, { recursive: true });
      await fs.writeFile(
        path.join(testEvilPath, 'secret.txt'),
        'secret data'
      );

      const response = await request(testServer!.host).get('/').query({
        action: 'folders',
        source: 'test',
        path: '../test-evil'
      });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should reject path that matches root prefix but is a different directory (files)', async () => {
      await fs.mkdir(testEvilPath, { recursive: true });
      await fs.writeFile(
        path.join(testEvilPath, 'secret.txt'),
        'secret data'
      );

      const response = await request(testServer!.host).get('/').query({
        action: 'files',
        source: 'test',
        path: '../test-evil'
      });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should reject path=../test2 when root is ./files/test', async () => {
      const test2Path = path.join(process.cwd(), './files/test2');
      await fs.mkdir(test2Path, { recursive: true });
      await fs.writeFile(path.join(test2Path, 'leaked.txt'), 'leaked data');

      try {
        const response = await request(testServer!.host).get('/').query({
          action: 'folders',
          source: 'test',
          path: '../test2'
        });

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
      } finally {
        await fs.rm(test2Path, { recursive: true, force: true });
      }
    });
  });

  // =========================================================================
  // 2. Traversal via `name` parameter in rename
  //
  // `renamePath` joins dirPath + fromName without validatePath.
  // Attack: name=../root-file.txt from /subdir reaches root directory.
  // =========================================================================
  describe('name parameter traversal in fileRename', () => {
    it('should reject name with ../ that escapes current directory', async () => {
      // Create a file in root and try to rename it from /subdir context
      await createTestFile('root-secret.txt', 'secret content');

      const response = await request(testServer!.host).get('/').query({
        action: 'fileRename',
        source: 'test',
        path: '/subdir',
        name: '../root-secret.txt',
        newname: 'stolen.txt'
      });

      // Should be rejected - the name escapes the current directory
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);

      // Verify the original file was NOT affected
      const originalExists = await fs
        .access(path.join(testFilesPath, 'root-secret.txt'))
        .then(() => true)
        .catch(() => false);
      expect(originalExists).toBe(true);
    });

    it('should reject name with ../ in fileRemove that escapes directory', async () => {
      await createTestFile('protected-file.txt', 'protected content');

      const response = await request(testServer!.host).get('/').query({
        action: 'fileRemove',
        source: 'test',
        path: '/subdir',
        name: '../protected-file.txt'
      });

      // Should be rejected
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);

      // Verify the original file was NOT deleted
      const exists = await fs
        .access(path.join(testFilesPath, 'protected-file.txt'))
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should reject name with ../ in fileDownload that escapes directory', async () => {
      await createTestFile('download-secret.txt', 'secret download content');

      const response = await request(testServer!.host).get('/').query({
        action: 'fileDownload',
        source: 'test',
        path: '/subdir',
        name: '../download-secret.txt'
      });

      // Should be rejected, not serve the file
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  // =========================================================================
  // 3. Traversal via `newname` parameter in rename
  //
  // `renamePath` joins dirPath + newName without validatePath.
  // Attack: newname=../escaped.txt moves file from subdir to root.
  // =========================================================================
  describe('newname parameter traversal in fileRename', () => {
    it('should reject newname with ../ that escapes current directory', async () => {
      await createTestFile('normal.txt', 'normal content', '/subdir');

      const response = await request(testServer!.host).get('/').query({
        action: 'fileRename',
        source: 'test',
        path: '/subdir',
        name: 'normal.txt',
        newname: '../escaped.txt'
      });

      // Should be rejected
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);

      // Verify file was NOT moved to root
      const escapedExists = await fs
        .access(path.join(testFilesPath, 'escaped.txt'))
        .then(() => true)
        .catch(() => false);
      expect(escapedExists).toBe(false);

      // Verify original file still exists
      const originalExists = await fs
        .access(path.join(testFilesPath, 'subdir', 'normal.txt'))
        .then(() => true)
        .catch(() => false);
      expect(originalExists).toBe(true);
    });

    it('should reject newname with ../ in folderRename', async () => {
      await fs.mkdir(path.join(testFilesPath, 'parent', 'inner'), {
        recursive: true
      });

      const response = await request(testServer!.host).get('/').query({
        action: 'folderRename',
        source: 'test',
        path: '/parent',
        name: 'inner',
        newname: '../escaped-folder'
      });

      // Should be rejected
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);

      // Verify folder was NOT moved to root
      const escapedExists = await fs
        .access(path.join(testFilesPath, 'escaped-folder'))
        .then(() => true)
        .catch(() => false);
      expect(escapedExists).toBe(false);
    });
  });

  // =========================================================================
  // 4. Traversal via `from` parameter in movePath
  //
  // `movePath` does path.join(root, from) without validatePath.
  // =========================================================================
  describe('from parameter traversal in fileMove', () => {
    it('should reject from with ../ prefix that escapes root', async () => {
      await fs.mkdir(testEvilPath, { recursive: true });
      await fs.writeFile(
        path.join(testEvilPath, 'evil.txt'),
        'evil content'
      );

      const response = await request(testServer!.host).get('/').query({
        action: 'fileMove',
        source: 'test',
        from: '/../test-evil/evil.txt',
        path: '/'
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject move to destination path outside root via path=../test-evil', async () => {
      await createTestFile('victim.txt', 'victim content');
      await fs.mkdir(testEvilPath, { recursive: true });

      const response = await request(testServer!.host).get('/').query({
        action: 'fileMove',
        source: 'test',
        from: '/victim.txt',
        path: '../test-evil'
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);

      // Verify file was NOT moved
      const originalExists = await fs
        .access(path.join(testFilesPath, 'victim.txt'))
        .then(() => true)
        .catch(() => false);
      expect(originalExists).toBe(true);
    });
  });

  // =========================================================================
  // 5. Symlink escape
  //
  // A symlink inside root pointing to an external directory allows
  // bypassing path.resolve() + startsWith() checks.
  // Only fs.realpath() can detect this.
  // =========================================================================
  describe('symlink escape', () => {
    const secretDir = '/tmp/jodit-security-test-secret';

    beforeEach(async () => {
      // Create external secret directory
      await fs.mkdir(secretDir, { recursive: true });
      await fs.writeFile(path.join(secretDir, 'secret.txt'), 'top secret');
    });

    it('should reject access through symlink pointing outside root', async () => {
      // Create symlink inside test root pointing to external directory
      const symlinkPath = path.join(testFilesPath, 'evil-link');

      try {
        await fs.symlink(secretDir, symlinkPath, 'dir');
      } catch {
        // Skip test if symlinks not supported
        return;
      }

      const response = await request(testServer!.host).get('/').query({
        action: 'folders',
        source: 'test',
        path: '/evil-link'
      });

      // Should reject - symlink escapes root
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should reject file download through symlink pointing outside root', async () => {
      const symlinkPath = path.join(testFilesPath, 'evil-link');

      try {
        await fs.symlink(secretDir, symlinkPath, 'dir');
      } catch {
        return;
      }

      const response = await request(testServer!.host).get('/').query({
        action: 'fileDownload',
        source: 'test',
        path: '/evil-link',
        name: 'secret.txt'
      });

      // Should reject - symlink escapes root
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject file listing through symlink pointing outside root', async () => {
      const symlinkPath = path.join(testFilesPath, 'evil-link');

      try {
        await fs.symlink(secretDir, symlinkPath, 'dir');
      } catch {
        return;
      }

      const response = await request(testServer!.host).get('/').query({
        action: 'files',
        source: 'test',
        path: '/evil-link'
      });

      // Should reject - symlink escapes root
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 6. Null byte injection
  //
  // Null bytes can truncate paths in some environments.
  // Modern Node.js throws on null bytes, but we should handle it gracefully.
  // =========================================================================
  describe('null byte injection', () => {
    it('should reject path containing null byte', async () => {
      const response = await request(testServer!.host).get('/').query({
        action: 'folders',
        source: 'test',
        path: '/subdir\0/../../../etc'
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject filename containing null byte', async () => {
      const response = await request(testServer!.host).get('/').query({
        action: 'fileRemove',
        source: 'test',
        name: 'test.txt\0.jpg'
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 7. Double-encoded path traversal
  //
  // %252e%252e%252f double-encodes to %2e%2e%2f after first decode,
  // then to ../../ after second decode.
  // =========================================================================
  describe('double-encoded path traversal', () => {
    it('should reject double-encoded ../ in path', async () => {
      await fs.mkdir(testEvilPath, { recursive: true });

      // %2e = '.', %2f = '/'
      // If the server decodes once, these become literal %2e%2f in the path
      // If decoded twice, they become ../
      const response = await request(testServer!.host).get('/').query({
        action: 'folders',
        source: 'test',
        path: '%2e%2e/test-evil'
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 8. Path traversal via folderCreate name parameter
  //
  // sanitize-filename handles this, but verify ../  in name is rejected.
  // =========================================================================
  describe('folderCreate name traversal', () => {
    it('should reject folder name with ../ traversal', async () => {
      const response = await request(testServer!.host).get('/').query({
        action: 'folderCreate',
        source: 'test',
        name: '../evil-folder'
      });

      // Should either sanitize the name or reject it
      // After sanitization, it should NOT create folder outside root
      if (response.status === 200) {
        // If sanitize-filename removed ../, verify folder was created inside root, not outside
        const evilExists = await fs
          .access(path.join(process.cwd(), 'files', 'evil-folder'))
          .then(() => true)
          .catch(() => false);
        expect(evilExists).toBe(false);
      } else {
        expect(response.body.success).toBe(false);
      }
    });
  });

  // =========================================================================
  // 9. Permission bypass via name traversal
  //
  // Access control checks use dirPath instead of the actual target path.
  // A user with access to /subdir should NOT be able to affect files
  // in the root via name=../file.txt
  // =========================================================================
  describe('ACL bypass via name traversal', () => {
    let aclServer: TestServer | null = null;

    afterEach(async () => {
      if (aclServer) {
        await stopTestServer(aclServer);
        aclServer = null;
      }
    });

    it('should not allow fileRemove in root when only /subdir is permitted via name=../', async () => {
      aclServer = await startTestServer({
        sources: {
          test: {
            name: 'test',
            title: 'Test Files',
            root: testFilesPath,
            baseurl: 'http://localhost:8081/files/test/'
          }
        },
        accessControl: [
          {
            role: 'guest',
            path: '/subdir',
            FILE_REMOVE: true
          },
          {
            role: 'guest',
            FILE_REMOVE: false
          }
        ],
        defaultRole: 'guest'
      });

      // Create file in root (should be protected)
      await createTestFile('root-protected.txt', 'protected content');

      const response = await request(aclServer!.host).get('/').query({
        action: 'fileRemove',
        source: 'test',
        path: '/subdir',
        name: '../root-protected.txt'
      });

      // Should be denied - file is in root, not in /subdir
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);

      // Verify file was NOT deleted
      const exists = await fs
        .access(path.join(testFilesPath, 'root-protected.txt'))
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });
});
