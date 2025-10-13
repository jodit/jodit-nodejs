import { start } from './index';
import type { AppConfig } from './types';
import { logger } from './helpers/logger';
import fs from 'fs';
import path from 'path';

// Parse CONFIG environment variable or CONFIG_FILE if provided
let customConfig: Partial<AppConfig> | undefined;

// Priority: CONFIG env var > CONFIG_FILE env var
if (process.env.CONFIG !== undefined && process.env.CONFIG.length > 0) {
  try {
    customConfig = JSON.parse(process.env.CONFIG) as Partial<AppConfig>;
  } catch (error) {
    logger.error('Failed to parse CONFIG environment variable:', error);
    process.exit(1);
  }
} else if (
  process.env.CONFIG_FILE !== undefined &&
  process.env.CONFIG_FILE.length > 0
) {
  try {
    const configPath = path.resolve(process.env.CONFIG_FILE);
    const configContent = fs.readFileSync(configPath, 'utf-8');
    customConfig = JSON.parse(configContent) as Partial<AppConfig>;
    logger.info(`Loaded configuration from ${configPath}`);
  } catch (error) {
    logger.error('Failed to read or parse CONFIG_FILE:', error);
    process.exit(1);
  }
}

// Parse PORT environment variable
const port =
  process.env.PORT !== undefined ? parseInt(process.env.PORT, 10) : 8081;

if (isNaN(port) || port <= 0 || port > 65535) {
  logger.error(
    'Invalid PORT environment variable. Must be a number between 1 and 65535.'
  );
  process.exit(1);
}

// Run the server with configuration from environment
start(port, customConfig).catch(_error => {
  process.exit(1);
});
