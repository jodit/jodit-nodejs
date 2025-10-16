const { LocalStorageAdapter } = require('@flystorage/local-fs');
const path = require('path');
const fs = require('fs');

async function test() {
  const testFilesPath = path.join(process.cwd(), './files/test');

  // Create test directory and files
  fs.mkdirSync(testFilesPath, { recursive: true });
  fs.writeFileSync(path.join(testFilesPath, 'test.txt'), 'test content');
  fs.writeFileSync(path.join(testFilesPath, 'image.png'), 'fake image');

  console.log('Test directory:', testFilesPath);
  console.log('Files in directory (using fs):', fs.readdirSync(testFilesPath));

  // Now try with LocalStorageAdapter
  const adapter = new LocalStorageAdapter(testFilesPath);

  console.log('\nTrying storage.list("")...');
  try {
    const files = [];
    for await (const entry of adapter.list('', { deep: false })) {
      console.log('Entry:', entry.path, 'isDir:', entry.isDirectory);
      files.push(entry.path);
    }
    console.log('Files found:', files);
  } catch (err) {
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
  }

  console.log('\nTrying storage.stat("test.txt")...');
  try {
    const stat = await adapter.stat('test.txt');
    console.log('Stat result:', stat);
  } catch (err) {
    console.error('Error:', err.message);
  }

  // Cleanup
  fs.rmSync(testFilesPath, { recursive: true, force: true });
}

test().catch(console.error);
