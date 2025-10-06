import { start } from './index';

// Run the server with default settings for testing/development
start().catch(_error => {
  process.exit(1);
});
