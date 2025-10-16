const { LocalStorageAdapter } = require('@flystorage/local-fs');
const path = require('path');
const fs = require('fs');

async function test() {
  const testFilesPath = path.join(process.cwd(), './files/test');

  // Create test directory and files
  fs.mkdirSync(testFilesPath, { recursive: true });
  fs.writeFileSync(path.join(testFilesPath, 'test.txt'), 'test content');
  fs.writeFileSync(path.join(testFilesPath, 'image.png'), 'fake image');
  fs.mkdirSync(path.join(testFilesPath, 'subfolder'), { recursive: true });

  console.log('Test directory:', testFilesPath);

  // Now try with LocalStorageAdapter
  const adapter = new LocalStorageAdapter(testFilesPath);

  console.log('\nTrying storage.stat("test.txt") with empty options...');
  try {
    const stat = await adapter.stat('test.txt', {});
    console.log('Stat result:', stat);
  } catch (err) {
    console.error('Error:', err.message);
  }

  console.log('\nTrying storage.stat("subfolder") with empty options...');
  try {
    const stat = await adapter.stat('subfolder', {});
    console.log('Stat result:', stat);
  } catch (err) {
    console.error('Error:', err.message);
  }

  // Cleanup
  fs.rmSync(testFilesPath, { recursive: true, force: true });
}

test().catch(console.error);
