const request = require('supertest');
const { createApp } = require('./dist/index.js');
const path = require('path');
const fs = require('fs');

const testFilesPath = path.join(process.cwd(), './files/test');

// Create test directory
if (!fs.existsSync(testFilesPath)) {
  fs.mkdirSync(testFilesPath, { recursive: true });
}
const subDir = path.join(testFilesPath, 'subdir');
if (!fs.existsSync(subDir)) {
  fs.mkdirSync(subDir, { recursive: true });
}

// Create test files
const testImagePath = path.join(subDir, 'test-image.png');
const testCsvPath = path.join(subDir, 'test-file.csv');
fs.writeFileSync(testImagePath, 'fake image content');
fs.writeFileSync(testCsvPath, 'test,csv,content');

const app = createApp({
  defaultFilesKey: 'files',
  sources: {
    test: {
      name: 'test',
      title: 'Test Files',
      root: testFilesPath,
      baseurl: 'http://localhost:8081/files/test/'
    }
  }
});

const server = app.listen(0, async () => {
  const port = server.address().port;
  const host = `http://localhost:${port}`;

  try {
    const response = await request(host)
      .post('/')
      .field('action', 'fileUpload')
      .field('source', 'test')
      .attach('files', testImagePath)
      .attach('files', testCsvPath);

    console.log('Status:', response.status);
    console.log('Body:', JSON.stringify(response.body, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    server.close();
    // Cleanup
    fs.rmSync(testFilesPath, { recursive: true, force: true });
  }
});
