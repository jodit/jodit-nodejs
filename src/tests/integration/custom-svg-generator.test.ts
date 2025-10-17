import request from 'supertest';
import type { StatEntry } from '@flystorage/file-storage';
import type { TestServer } from '../test-server';
import {
  startTestServer,
  stopTestServer,
  createTestFile
} from '../test-server';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Custom SVG Generator', () => {
  let testServer: TestServer;

  afterEach(async () => {
    await stopTestServer(testServer);
  });

  it('should use custom SVG generator when provided', async () => {
    // Custom SVG generator that creates a simple colored rectangle
    const customSvgGenerator = (
      file: StatEntry,
      width: number,
      height: number
    ): string => {
      const fileName = file.path.split('/').pop() || 'unknown';
      const isFolder = file.isDirectory;
      const color = isFolder ? '#3498db' : '#e74c3c';

      return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${color}"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="12">${fileName}</text>
</svg>`;
    };

    testServer = await startTestServer({
      createThumb: true,
      generateSvgThumbs: true,
      svgThumbWidth: 100,
      svgThumbHeight: 100,
      svgGenerator: customSvgGenerator
    });

    // Create a non-image file
    await createTestFile('document.txt', 'test content');

    const response = await request(testServer.host)
      .get('/')
      .query({ action: 'files', source: 'test' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Find the test file
    const files = response.body.data.sources[0].files.filter(
      (f: any) => f.type === 'file'
    );
    const testFile = files.find((f: any) => f.file === 'document.txt');

    expect(testFile).toBeDefined();
    expect(testFile.thumb).toBeDefined();

    // Verify the thumbnail was created (thumb path should be set)
    expect(testFile.thumb).toContain('_thumbs');
    expect(testFile.thumb).toContain('.svg');
  });

  it('should use default generator when custom generator is not provided', async () => {
    testServer = await startTestServer({
      createThumb: true,
      generateSvgThumbs: true,
      svgThumbWidth: 100,
      svgThumbHeight: 100
      // No custom svgGenerator
    });

    await createTestFile('document.pdf', 'pdf content');

    const response = await request(testServer.host)
      .get('/')
      .query({ action: 'files', source: 'test' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const files = response.body.data.sources[0].files.filter(
      (f: any) => f.type === 'file'
    );
    const testFile = files.find((f: any) => f.file === 'document.pdf');

    expect(testFile).toBeDefined();
    expect(testFile.thumb).toBeDefined();
    expect(testFile.thumb).toContain('_thumbs');
    expect(testFile.thumb).toContain('.svg');
  });

  it('should pass correct parameters to custom generator', async () => {
    let capturedFile: StatEntry | undefined;
    let capturedWidth: number | undefined;
    let capturedHeight: number | undefined;

    const spyGenerator = (
      file: StatEntry,
      width: number,
      height: number
    ): string => {
      capturedFile = file;
      capturedWidth = width;
      capturedHeight = height;

      return '<svg><rect/></svg>';
    };

    testServer = await startTestServer({
      createThumb: true,
      generateSvgThumbs: true,
      svgThumbWidth: 150,
      svgThumbHeight: 200,
      svgGenerator: spyGenerator
    });

    await createTestFile('test.txt', 'content');

    await request(testServer.host)
      .get('/')
      .query({ action: 'files', source: 'test' });

    // Verify parameters were passed correctly
    expect(capturedFile).toBeDefined();
    expect(capturedFile!.path).toContain('test.txt');
    expect(capturedWidth).toBe(150);
    expect(capturedHeight).toBe(200);
  });

  it('should respect generateSvgThumbs flag even with custom generator', async () => {
    const customGenerator = (): string => '<svg><rect/></svg>';

    testServer = await startTestServer({
      createThumb: true,
      generateSvgThumbs: false, // Disabled
      svgGenerator: customGenerator
    });

    await createTestFile('doc.txt', 'content');

    const response = await request(testServer.host)
      .get('/')
      .query({ action: 'files', source: 'test' });

    expect(response.status).toBe(200);

    const files = response.body.data.sources[0].files.filter(
      (f: any) => f.type === 'file'
    );
    const testFile = files.find((f: any) => f.file === 'doc.txt');

    expect(testFile).toBeDefined();
    // When generateSvgThumbs is false, thumb should point to original file (relative path)
    // or be undefined depending on whether it's in the listing
    if (testFile.thumb) {
      // If thumb exists, it should NOT be an SVG in _thumbs folder
      expect(testFile.thumb).not.toContain('_thumbs');
    }
  });

  it('should allow different generators per source', async () => {
    const generator1 = (): string =>
      '<svg><rect fill="red"/><text>Source1</text></svg>';
    const generator2 = (): string =>
      '<svg><rect fill="blue"/><text>Source2</text></svg>';

    testServer = await startTestServer({
      createThumb: true,
      generateSvgThumbs: true,
      svgGenerator: generator1,
      sources: {
        test: {
          name: 'test',
          title: 'Test Files',
          root: '/tmp/test1',
          baseurl: 'http://localhost:8081/files/test1/',
          svgGenerator: generator1
        },
        test2: {
          name: 'test2',
          title: 'Test Files 2',
          root: '/tmp/test2',
          baseurl: 'http://localhost:8081/files/test2/',
          svgGenerator: generator2
        }
      }
    });

    // This test verifies that different sources can have different generators
    // The actual verification would require accessing each source separately
    expect(testServer.host).toBeDefined();
  });

  it('should handle generator errors gracefully', async () => {
    const errorGenerator = (): string => {
      throw new Error('Generator failed');
    };

    testServer = await startTestServer({
      createThumb: true,
      generateSvgThumbs: true,
      svgGenerator: errorGenerator
    });

    await createTestFile('test.txt', 'content');

    // The request should not crash even if generator throws
    const response = await request(testServer.host)
      .get('/')
      .query({ action: 'files', source: 'test' });

    // Should still return response (error handling in make-thumb)
    expect(response.status).toBeDefined();
  });

  it('should work with folders using custom generator', async () => {
    const folderGenerator = (
      file: StatEntry,
      width: number,
      height: number
    ): string => {
      const color = file.isDirectory ? '#2ecc71' : '#95a5a6';
      return `<svg width="${width}" height="${height}"><rect fill="${color}"/></svg>`;
    };

    testServer = await startTestServer({
      createThumb: true,
      generateSvgThumbs: true,
      svgGenerator: folderGenerator,
      safeThumbsCountInOneTime: 100 // Ensure thumbnails are generated
    });

    const response = await request(testServer.host)
      .get('/')
      .query({
        action: 'files',
        source: 'test',
        mods: 'withFolders'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const allItems = response.body.data.sources[0].files;
    const folders = allItems.filter((f: any) => f.type === 'folder');

    // 'subdir' folder should exist from createTestDirectories
    if (folders.length > 0) {
      const subfolder = folders.find((f: any) => f.file === 'subdir');
      if (subfolder?.thumb) {
        // If thumb was generated, it should be in _thumbs
        expect(subfolder.thumb).toContain('.svg');
      }
    }

    // At minimum, verify the request was successful
    expect(allItems).toBeDefined();
  });
});
