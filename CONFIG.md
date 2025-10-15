# Configuration Reference

This document provides a comprehensive reference for all configuration options available in Jodit Connector Node.js.

## Table of Contents

- [Configuration Format](#configuration-format)
- [General Settings](#general-settings)
- [File Sources](#file-sources)
- [File Handling](#file-handling)
- [Image Processing](#image-processing)
- [Thumbnails](#thumbnails)
- [Access Control & Security](#access-control--security)
- [Performance](#performance)
- [PDF Generation](#pdf-generation)
- [Unused/Legacy Parameters](#unusedlegacy-parameters)

## Configuration Format

Configuration can be provided in several ways:

1. **Programmatically** (TypeScript/JavaScript):
```typescript
import { start } from 'jodit-nodejs';

await start({
  port: 8081,
  config: {
    debug: false,
    allowCrossOrigin: true,
    sources: {
      uploads: {
        title: 'Uploads',
        root: '/path/to/files',
        baseurl: 'http://localhost:8081/files/'
      }
    }
  }
});
```

2. **Environment variable** (`CONFIG`):
```bash
CONFIG='{"debug":false,"allowCrossOrigin":true}' npm start
```

3. **Config file** (`CONFIG_FILE`):
```bash
CONFIG_FILE=/path/to/config.json npm start
```


---

## General Settings

### `debug`
- **Type**: `boolean`
- **Default**: `true`
- **Used**: ✅ Yes
- **Purpose**: Controls error logging verbosity
- **Usage**: When `true`, detailed error messages with stack traces are logged. In production, set to `false`.

**Example**:
```typescript
{
  debug: false  // Disable verbose logging in production
}
```

### `title`
- **Type**: `string`
- **Default**: `""`
- **Used**: ⚠️ Not currently used
- **Purpose**: Application title (reserved for future use)

### `defaultFilesKey`
- **Type**: `string`
- **Default**: `"default"`
- **Used**: ✅ Yes
- **Purpose**: Default field name for file uploads when source-specific key is not set
- **Usage**: Used as fallback when `SourceConfig.defaultFilesKey` is not specified

**Example**:
```typescript
{
  defaultFilesKey: 'files'  // Matches <input name="files[]" type="file">
}
```

---

## File Sources

### `sources`
- **Type**: `Record<string, SourceConfig>`
- **Default**: Single "default" source
- **Used**: ✅ Yes
- **Purpose**: Defines available file storage locations
- **Required**: Yes

**SourceConfig properties**:

#### `sources[name].name`
- **Type**: `string`
- **Required**: Yes
- **Purpose**: Unique identifier for the source

#### `sources[name].title`
- **Type**: `string`
- **Required**: No
- **Default**: Source name
- **Purpose**: Display name shown in file browser

#### `sources[name].root`
- **Type**: `string`
- **Required**: Yes
- **Purpose**: Absolute path to the root directory for file storage

#### `sources[name].baseurl`
- **Type**: `string`
- **Required**: Yes
- **Purpose**: Base URL for accessing files via HTTP

#### `sources[name].defaultFilesKey`
- **Type**: `string`
- **Required**: No
- **Purpose**: Source-specific field name for file uploads (overrides global `defaultFilesKey`)

**Example**:
```typescript
{
  sources: {
    uploads: {
      name: 'uploads',
      title: 'User Uploads',
      root: '/var/www/uploads',
      baseurl: 'https://cdn.example.com/uploads/',
      defaultFilesKey: 'userfiles'
    },
    images: {
      name: 'images',
      title: 'Images',
      root: '/var/www/images',
      baseurl: 'https://cdn.example.com/images/'
    }
  }
}
```

---

## File Handling

### `extensions`
- **Type**: `string[]`
- **Default**: `['jpg', 'png', 'gif', 'pdf', 'doc', 'txt', 'zip', ...]`
- **Used**: ✅ Yes
- **Purpose**: Whitelist of allowed file extensions
- **Usage**: Files with extensions not in this list will be rejected

**Example**:
```typescript
{
  extensions: ['jpg', 'png', 'gif', 'pdf', 'doc', 'docx']
}
```

### `maxUploadFileSize`
- **Type**: `string`
- **Default**: `"8mb"`
- **Used**: ✅ Yes
- **Purpose**: Maximum allowed size for uploaded files
- **Format**: Number + unit (e.g., "8mb", "100kb", "1gb")

**Example**:
```typescript
{
  maxUploadFileSize: '10mb'
}
```

### `maxFileSize`
- **Type**: `string`
- **Default**: `"8mb"`
- **Used**: ⚠️ Not currently used
- **Note**: Use `maxUploadFileSize` instead

### `saveSameFileNameStrategy`
- **Type**: `string`
- **Default**: `"addNumber"`
- **Used**: ✅ Yes
- **Purpose**: Strategy for handling duplicate filenames during upload
- **Values**:
  - `"error"` - Reject upload if file exists
  - `"replace"` - Overwrite existing file
  - `"addNumber"` - Append number to filename (e.g., `file(1).jpg`)

**Example**:
```typescript
{
  saveSameFileNameStrategy: 'addNumber'
}
```

### `defaultPermission`
- **Type**: `number`
- **Default**: `0o775`
- **Used**: ✅ Yes
- **Purpose**: Unix file permissions for newly created folders
- **Format**: Octal number

**Example**:
```typescript
{
  defaultPermission: 0o755  // rwxr-xr-x
}
```

### `datetimeFormat`
- **Type**: `string`
- **Default**: `"M/D/YYYY h:mm A"`
- **Used**: ✅ Yes
- **Purpose**: Format string for file modification dates in listings
- **Format**: Uses [Day.js format tokens](https://day.js.org/docs/en/display/format)

**Example**:
```typescript
{
  datetimeFormat: 'YYYY-MM-DD HH:mm:ss'
}
```

### `defaultSortBy`
- **Type**: `string`
- **Default**: `"changed-desc"`
- **Used**: ✅ Yes
- **Purpose**: Default sort order for file listings
- **Values**: `"name-asc"`, `"name-desc"`, `"size-asc"`, `"size-desc"`, `"changed-asc"`, `"changed-desc"`

**Example**:
```typescript
{
  defaultSortBy: 'name-asc'
}
```

### `countInChunk`
- **Type**: `number`
- **Default**: `1000000`
- **Used**: ✅ Yes
- **Purpose**: Default pagination limit for file listings

**Example**:
```typescript
{
  countInChunk: 100  // Return max 100 files per request
}
```

### `excludeDirectoryNames`
- **Type**: `string[]`
- **Default**: `['.tmb', '.quarantine']`
- **Used**: ✅ Yes
- **Purpose**: List of directory names to exclude from file listings

**Example**:
```typescript
{
  excludeDirectoryNames: ['.git', '.svn', 'node_modules', '_thumbs']
}
```

---

## Image Processing

### `imageExtensions`
- **Type**: `string[]`
- **Default**: `['jpg', 'png', 'gif', 'jpeg', 'bmp', 'svg', 'ico', 'webp']`
- **Used**: ✅ Yes
- **Purpose**: File extensions that should be treated as images
- **Usage**: Used for thumbnail generation and image-specific operations

**Example**:
```typescript
{
  imageExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp']
}
```

### `quality`
- **Type**: `number`
- **Default**: `90`
- **Used**: ✅ Yes
- **Purpose**: JPEG quality for thumbnail generation (1-100)

**Example**:
```typescript
{
  quality: 85
}
```

### `maxImageWidth`
- **Type**: `number`
- **Default**: `1900`
- **Used**: ⚠️ Not currently enforced
- **Purpose**: Maximum allowed image width in pixels (reserved for future validation)

### `maxImageHeight`
- **Type**: `number`
- **Default**: `1900`
- **Used**: ⚠️ Not currently enforced
- **Purpose**: Maximum allowed image height in pixels (reserved for future validation)

---

## Thumbnails

### `createThumb`
- **Type**: `boolean`
- **Default**: `true`
- **Used**: ✅ Yes
- **Purpose**: Enable/disable thumbnail generation for images

**Example**:
```typescript
{
  createThumb: false  // Disable thumbnails for faster performance
}
```

### `thumbSize`
- **Type**: `number`
- **Default**: `250`
- **Used**: ✅ Yes
- **Purpose**: Thumbnail dimensions in pixels (both width and height)

**Example**:
```typescript
{
  thumbSize: 150  // Generate 150x150px thumbnails
}
```

### `thumbFolderName`
- **Type**: `string`
- **Default**: `"_thumbs"`
- **Used**: ✅ Yes
- **Purpose**: Name of the folder where thumbnails are stored

**Example**:
```typescript
{
  thumbFolderName: '.thumbnails'
}
```

### `safeThumbsCountInOneTime`
- **Type**: `number`
- **Default**: `20`
- **Used**: ✅ Yes
- **Purpose**: Maximum number of thumbnails to generate in a single request
- **Usage**: Prevents performance issues when listing large directories

**Example**:
```typescript
{
  safeThumbsCountInOneTime: 10  // Generate max 10 thumbnails per request
}
```

---

## Access Control & Security

### `accessControl`
- **Type**: `AccessControlRule[]`
- **Default**: `[]` (no restrictions)
- **Used**: ✅ Yes
- **Purpose**: Define role-based permissions for actions
- **Documentation**: See [Authentication & Access Control](./README.md#authentication--access-control)

**Example**:
```typescript
{
  accessControl: [
    {
      role: 'guest',
      FILES: true,
      FILE_UPLOAD: false,
      FILE_REMOVE: false
    },
    {
      role: 'admin',
      FILES: true,
      FILE_UPLOAD: true,
      FILE_REMOVE: true
    }
  ]
}
```

### `defaultRole`
- **Type**: `string`
- **Default**: `"guest"`
- **Used**: ✅ Yes
- **Purpose**: Default user role when no authentication is provided
- **Usage**: Used as fallback when `checkAuthentication` callback is not set

**Example**:
```typescript
{
  defaultRole: 'user'
}
```

### `roleSessionVar`
- **Type**: `string`
- **Default**: `"JoditUserRole"`
- **Used**: ⚠️ Not currently used
- **Note**: Authentication uses `checkAuthentication` callback instead

### `allowCrossOrigin`
- **Type**: `boolean`
- **Default**: `false`
- **Used**: ✅ Yes
- **Purpose**: Enable/disable CORS headers
- **Usage**: When `true`, adds `Access-Control-Allow-*` headers

**Example**:
```typescript
{
  allowCrossOrigin: true  // Allow requests from any origin
}
```

### `allowReplaceSourceFile`
- **Type**: `boolean`
- **Default**: `true`
- **Used**: ⚠️ Not currently used
- **Note**: Reserved for future use

---

## Performance

### `memoryLimit`
- **Type**: `string`
- **Default**: `"256M"`
- **Used**: ⚠️ Not currently used
- **Note**: Reserved for future use (Node.js memory limits are set via `--max-old-space-size`)

### `timeoutLimit`
- **Type**: `number`
- **Default**: `60`
- **Used**: ⚠️ Not currently used
- **Note**: Reserved for future use (HTTP timeouts are configured at server level)

---

## PDF Generation

### `pdf`
- **Type**: `PdfConfig`
- **Used**: ⚠️ Not currently used
- **Note**: PDF generation uses Puppeteer directly with options from query parameters

The `pdf` configuration object has the following properties (all unused):

- `pdf.defaultFont` (string, default: `"serif"`)
- `pdf.isRemoteEnabled` (boolean, default: `true`)
- `pdf.fontDir` (string, default: system temp dir)
- `pdf.fontCache` (string, default: system temp dir)
- `pdf.tempDir` (string, default: system temp dir)
- `pdf.chroot` (string, default: system temp dir)
- `pdf.paper.format` (string, default: `"A4"`)
- `pdf.paper.page_orientation` (string, default: `"portrait"`)

**Current PDF generation**: Uses Puppeteer with options passed via query parameters:
```bash
curl "http://localhost:8081/?action=generatePdf&html=<html>&options[format]=A4&options[page_orientation]=landscape"
```

---

## Unused/Legacy Parameters

The following parameters are defined in the configuration but are **not currently used** in the codebase:

| Parameter | Type | Default | Note |
|-----------|------|---------|------|
| `title` | string | `""` | Reserved for application title |
| `maxFileSize` | string | `"8mb"` | Use `maxUploadFileSize` instead |
| `memoryLimit` | string | `"256M"` | Node.js memory limits set via CLI |
| `timeoutLimit` | number | `60` | HTTP timeouts configured at server level |
| `sourceClassName` | string | `"FileSystem"` | Sources are hardcoded to FileSystem |
| `allowReplaceSourceFile` | boolean | `true` | Reserved for future use |
| `root` | string | `"./files"` | Use `SourceConfig.root` instead |
| `baseurl` | string | `""` | Use `SourceConfig.baseurl` instead |
| `roleSessionVar` | string | `"JoditUserRole"` | Use `checkAuthentication` callback |
| `maxImageWidth` | number | `1900` | Not enforced (reserved for validation) |
| `maxImageHeight` | number | `1900` | Not enforced (reserved for validation) |
| `pdf.*` | object | - | PDF generation uses query parameters |

---

## Configuration Examples

### Minimal Configuration
```typescript
{
  sources: {
    default: {
      name: 'default',
      title: 'Files',
      root: '/var/www/files',
      baseurl: 'http://localhost:8081/files/'
    }
  }
}
```

### Production Configuration
```typescript
{
  debug: false,
  allowCrossOrigin: false,
  maxUploadFileSize: '10mb',
  createThumb: true,
  thumbSize: 200,
  safeThumbsCountInOneTime: 10,
  defaultRole: 'guest',
  accessControl: [
    {
      role: 'guest',
      FILES: true,
      FILE_UPLOAD: false
    },
    {
      role: 'user',
      FILES: true,
      FILE_UPLOAD: true,
      FILE_REMOVE: false
    },
    {
      role: 'admin',
      FILES: true,
      FILE_UPLOAD: true,
      FILE_REMOVE: true,
      FOLDER_CREATE: true,
      FOLDER_REMOVE: true
    }
  ],
  sources: {
    uploads: {
      name: 'uploads',
      title: 'User Uploads',
      root: '/var/www/uploads',
      baseurl: 'https://cdn.example.com/uploads/'
    },
    public: {
      name: 'public',
      title: 'Public Files',
      root: '/var/www/public',
      baseurl: 'https://cdn.example.com/public/'
    }
  }
}
```

### High Performance Configuration
```typescript
{
  debug: false,
  createThumb: false,  // Disable thumbnails
  countInChunk: 50,    // Limit results per page
  safeThumbsCountInOneTime: 0,  // No thumbnails
  excludeDirectoryNames: ['.git', 'node_modules', '_thumbs'],
  sources: {
    fast: {
      name: 'fast',
      title: 'Fast Storage',
      root: '/ssd/files',
      baseurl: 'http://localhost:8081/files/'
    }
  }
}
```

---

## Environment Variables

The default configuration uses environment variables for easy customization:

- `SOURCE_NAME` - Display name for default source (default: "Test Files")
- `SOURCE_ROOT` - Root directory for default source (default: "./files/")
- `SOURCE_BASEURL` - Base URL for default source (default: "http://localhost:{PORT}/files/")
- `PORT` - Server port (default: 8081)
- `CONFIG` - Full JSON configuration (overrides all other config)
- `CONFIG_FILE` - Path to JSON config file

**Example**:
```bash
SOURCE_NAME="Production Files" \
SOURCE_ROOT="/var/www/files" \
SOURCE_BASEURL="https://cdn.example.com/files/" \
PORT=8080 \
npm start
```

---

## See Also

- [README.md](./README.md) - General documentation
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment instructions
- [examples/](./examples/) - Configuration examples
