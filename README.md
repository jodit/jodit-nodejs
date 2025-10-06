# Jodit Connector Application (Node.js)

Node.js/TypeScript implementation of the Jodit File Browser and Uploader connector.

Analog of the PHP version: [jodit-connector-application](https://github.com/xdan/jodit-connectors)

## Technology Stack

- **Node.js LTS** (v18+)
- **TypeScript** with strict typing
- **Express 5.x** for REST API
- **Zod** for runtime validation
- **@hapi/boom** for error handling
- **Winston** for logging
- **Jest + Supertest** for testing
- **ESLint + Prettier** for code quality
- **Nodemon** for development

## Installation

```bash
npm install
```

## Scripts

### Development
```bash
npm run dev          # Run with nodemon (hot reload)
```

### Production
```bash
npm run build        # Compile TypeScript
npm start            # Run compiled application
```

### Testing
```bash
npm test             # Run all tests
npm run test:watch   # Run in watch mode
npm run test:coverage # Run with code coverage
```

### Linting
```bash
npm run lint         # Check code
npm run lint:fix     # Auto-fix issues
```

### Docker
```bash
npm run docker:build # Build Docker image
npm run docker:run   # Run container (port 3000)

# Or manually:
docker build -t jodit-connector-nodejs .
docker run --rm -p 3000:3000 jodit-connector-nodejs
```

## Project Structure

```
jodit-connector-application-nodejs/
├── src/
│   ├── v1/                  # API handlers (files, ping, etc.)
│   ├── config/              # Application configuration
│   ├── helpers/             # Utility functions (logger, file-system)
│   ├── middlewares/         # Express middleware (validation, custom-config)
│   ├── schemas/             # Zod validation schemas
│   ├── types/               # TypeScript types and interfaces
│   ├── tests/               # Tests
│   │   ├── integration/     # Integration tests
│   │   └── test-server.ts   # Test server utilities
│   ├── app.ts               # Express application factory
│   ├── index.ts             # Entry point (exports start/stop/createApp)
│   └── run.ts               # Default app launcher for development
├── files/                   # Files directory (gitignored)
├── dist/                    # Compiled code (gitignored)
├── package.json
├── tsconfig.json
├── jest.config.js
├── eslint.config.js
└── .prettierrc
```

## API Usage

### As NPM Package

```typescript
import { start, stop, createApp } from 'jodit-connector-application-nodejs';
import type { AppConfig } from 'jodit-connector-application-nodejs/types';

// Start server with default config
const server = await start(3000);

// Start server with custom config
const customConfig: Partial<AppConfig> = {
  debug: false,
  allowCrossOrigin: true,
  sources: {
    myfiles: {
      title: 'My Files',
      root: '/path/to/files',
      baseurl: 'http://localhost:3000/files/'
    }
  }
};
const server = await start(3000, customConfig);

// Or create Express app directly
const app = createApp(customConfig);
app.listen(3000);

// Stop server
await stop();
```

### API Endpoints

#### GET /?action=files

Get list of files from source.

**Parameters:**
- `action` (required) - action name ("files")
- `source` (optional) - source name
- `path` (optional) - path within source (default: "/")
- `mods` (optional) - modifiers ("withFolders" to include folders)

**Examples:**

```bash
# Get all files from "test" source
curl "http://localhost:3000/?action=files&source=test"

# Get files with folders
curl "http://localhost:3000/?action=files&source=test&mods=withFolders"

# Get files from subfolder
curl "http://localhost:3000/?action=files&source=test&path=/subfolder"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "code": 220,
    "sources": [
      {
        "name": "test",
        "title": "Test Files",
        "baseurl": "http://localhost:3000/files/test/",
        "path": "/",
        "files": [
          {
            "file": "image.png",
            "name": "image.png",
            "type": "file",
            "size": 1024,
            "changed": "2025-01-01T00:00:00.000Z",
            "isImage": true
          }
        ]
      }
    ]
  }
}
```

#### GET /ping

Health check endpoint.

**Response:**
```json
{
  "success": true
}
```

## Configuration

Default configuration is in `src/config/index.ts`. Full config structure (same as PHP version):

```typescript
export const config: AppConfig = {
  // Basic settings
  title: '',
  defaultFilesKey: 'files',
  saveSameFileNameStrategy: 'addNumber',
  debug: true,

  // Sources
  sources: {
    test: {
      title: 'Test Files',
      root: path.join(__dirname, '../../files/test'),
      baseurl: 'http://localhost:3000/files/test/'
    }
  },

  // File handling
  root: path.join(__dirname, '../../files'),
  baseurl: '',
  extensions: ['jpg', 'png', 'gif', 'pdf', 'doc', /* ... */],
  imageExtensions: ['jpg', 'png', 'gif', 'jpeg', 'bmp', 'svg', 'ico', 'webp'],
  maxFileSize: '8mb',
  maxUploadFileSize: '8M',

  // Thumbnails
  createThumb: true,
  thumbSize: 250,
  thumbFolderName: '_thumbs',
  safeThumbsCountInOneTime: 20,

  // Image processing
  quality: 90,
  maxImageWidth: 1900,
  maxImageHeight: 1900,

  // Sorting and formatting
  defaultSortBy: 'changed-desc',
  datetimeFormat: 'M/D/YYYY h:mm A',

  // Security
  excludeDirectoryNames: ['.tmb', '.quarantine'],
  accessControl: [],
  roleSessionVar: 'JoditUserRole',
  defaultRole: 'guest',
  allowReplaceSourceFile: true,

  // Performance
  countInChunk: 1000000,
  memoryLimit: '256M',
  timeoutLimit: 60,
  allowCrossOrigin: false,

  // PDF configuration
  pdf: {
    defaultFont: 'serif',
    isRemoteEnabled: true,
    fontDir: tmpDir,
    fontCache: tmpDir,
    tempDir: tmpDir,
    chroot: tmpDir,
    paper: {
      format: 'A4',
      page_orientation: 'portrait'
    }
  }
};
```

### Custom Config via Query (Debug Mode Only)

Like the PHP version, you can pass custom config via `custom_config` query parameter, but **only when `debug: true`**:

```bash
# This works only in debug mode
curl "http://localhost:3000/?action=files&custom_config={\"sources\":{\"custom\":{\"title\":\"Custom\",\"root\":\"/path\",\"baseurl\":\"http://...\"}}}"
```

The config is validated with Zod schemas and will return 400 if invalid.

## Implemented Functions

- ✅ **actionFiles** - get list of files
- ⏳ actionFileUpload - upload files
- ⏳ actionFileRemove - remove files
- ⏳ actionFileMove - move files
- ⏳ actionFileRename - rename files
- ⏳ actionFolderCreate - create folders
- ⏳ actionImageCrop - crop images
- ⏳ actionImageResize - resize images

## Tests

All tests use Jest + Supertest for integration testing:
- 9 integration tests covering all scenarios
- Automatic test data cleanup
- Test isolation with separate app instances
- Config validation tests

Run tests:
```bash
npm test                # All tests
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage
```

## Key Features

### ✅ Input Validation
- **Zod schemas** for all query parameters and config
- Runtime validation with detailed error messages
- Type-safe validated data

### ✅ Error Handling
- **@hapi/boom** for structured errors
- Automatic error transformation to API format
- Debug mode with stack traces

### ✅ Logging
- **Winston** logger with custom levels
- Colored console output
- Silent mode for tests
- Debug/info/warn/error levels

### ✅ Configuration
- Full config like PHP version (50+ options)
- Runtime config merging (startup + custom_config)
- Custom config via query (debug mode only)
- Zod validation on startup and runtime

### ✅ Architecture
- Factory pattern with `createApp()`
- Middleware-based validation
- Handler-specific validation
- Separation of concerns (v1 handlers, middlewares, schemas)

## Docker Deployment

The application includes a multi-stage Dockerfile for optimized production builds:

### Build and Run
```bash
# Build image
npm run docker:build

# Run container
npm run docker:run

# Or manually
docker build -t jodit-connector-nodejs .
docker run --rm -p 3000:3000 jodit-connector-nodejs
```

### Docker Image Details
- **Base image**: Node.js 24 (builder) → Node.js 24-alpine (runtime)
- **Multi-stage build**: Reduces final image size
- **Production optimized**: Prunes dev dependencies
- **Port**: 3000 (exposed)

### Dockerfile Stages
1. **Builder stage**: Installs all deps, compiles TypeScript
2. **Runtime stage**: Copies only dist and production node_modules
3. **Lightweight**: Alpine Linux for minimal footprint

## CI/CD

GitHub Actions workflow runs on:
- **Push to main** - runs tests and linter
- **Pull requests** - runs tests and linter
- **Tags** - builds and pushes Docker image to DockerHub

### Workflow Jobs
1. **test** - Runs linter, tests, and build
2. **docker** - Builds multi-arch image and pushes to DockerHub (only on tags)

### Required Secrets
- `DOCKERHUB_USERNAME` - DockerHub username
- `DOCKERHUB_TOKEN` - DockerHub access token

### Release Process
```bash
# Create and push a tag
git tag v1.0.0
git push origin v1.0.0

# GitHub Actions will automatically:
# - Run tests
# - Build Docker image
# - Push to DockerHub as latest and v1.0.0
```

## Differences from PHP Version

- **Async/await** instead of synchronous operations
- **TypeScript** for compile-time type safety
- **Zod** for runtime validation
- **Express 5.x** instead of built-in PHP server
- **Winston** for structured logging
- **@hapi/boom** for error handling
- **Jest** instead of Codeception

## License

MIT
