# Configuration Reference

This document provides a comprehensive reference for all configuration options available in Jodit Connector Node.js.

## Table of Contents

- [Configuration Format](#configuration-format)
- [General Settings](#general-settings)
- [File Sources](#file-sources)
- [Source-Level Configuration Overrides](#source-level-configuration-overrides)
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

## Source-Level Configuration Overrides

**New Feature**: Each source can override any global configuration setting (except `sources` itself). This allows you to have different configurations for different file storage locations.

### How It Works

When you add any `AppConfig` property to a `SourceConfig`, that property will override the global configuration for that specific source only. This is implemented using JavaScript Proxy pattern, which checks source-specific settings first before falling back to global configuration.

### Supported Overrides

Any configuration property can be overridden at the source level, including:

- **File handling**: `extensions`, `maxUploadFileSize`, `saveSameFileNameStrategy`
- **Image processing**: `imageExtensions`, `quality`, `maxImageWidth`, `maxImageHeight`
- **Thumbnails**: `createThumb`, `thumbSize`, `thumbFolderName`, `generateSvgThumbs`, `svgThumbWidth`, `svgThumbHeight`, `svgGenerator`, `safeThumbsCountInOneTime`
- **Formatting**: `datetimeFormat`
- **Performance**: `countInChunk`, `excludeDirectoryNames`
- And any other `AppConfig` property

**Note**: The `sources` property cannot be overridden at source level to prevent circular references.

### Basic Example

```typescript
await start({
  port: 8081,
  config: {
    // Global settings
    extensions: ['txt', 'doc', 'pdf'],
    maxUploadFileSize: '10MB',
    thumbSize: 250,

    sources: {
      images: {
        name: 'images',
        root: '/var/www/images',
        baseurl: 'https://cdn.example.com/images/',
        // Override for images source
        extensions: ['jpg', 'png', 'gif', 'webp'],  // Only images
        maxUploadFileSize: '5MB',                    // Smaller limit
        thumbSize: 150                               // Smaller thumbnails
      },
      documents: {
        name: 'documents',
        root: '/var/www/docs',
        baseurl: 'https://cdn.example.com/docs/',
        // Partial override for documents source
        maxUploadFileSize: '50MB'  // Larger limit for docs
        // extensions and thumbSize will use global values
      }
    }
  }
});
```

### Real-World Examples

#### Example 1: Different File Types per Source

```typescript
{
  // Global: Accept common file types
  extensions: ['txt', 'pdf', 'doc', 'docx'],

  sources: {
    images: {
      name: 'images',
      root: '/var/www/images',
      baseurl: 'https://cdn.example.com/images/',
      extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
    },
    videos: {
      name: 'videos',
      root: '/var/www/videos',
      baseurl: 'https://cdn.example.com/videos/',
      extensions: ['mp4', 'webm', 'mov', 'avi'],
      maxUploadFileSize: '100MB'  // Larger for videos
    },
    documents: {
      name: 'documents',
      root: '/var/www/docs',
      baseurl: 'https://cdn.example.com/docs/',
      // Uses global extensions
    }
  }
}
```

#### Example 2: Different Upload Strategies

```typescript
{
  // Global: Add number to duplicates
  saveSameFileNameStrategy: 'addNumber',

  sources: {
    temp: {
      name: 'temp',
      root: '/var/www/temp',
      baseurl: 'https://cdn.example.com/temp/',
      saveSameFileNameStrategy: 'replace'  // Always overwrite in temp
    },
    production: {
      name: 'production',
      root: '/var/www/production',
      baseurl: 'https://cdn.example.com/production/',
      saveSameFileNameStrategy: 'error'  // Never allow duplicates
    }
  }
}
```

#### Example 3: Different Thumbnail Settings

```typescript
{
  // Global: Medium thumbnails
  createThumb: true,
  thumbSize: 250,
  thumbFolderName: '_thumbs',
  quality: 90,

  sources: {
    highQuality: {
      name: 'highQuality',
      root: '/var/www/hq-images',
      baseurl: 'https://cdn.example.com/hq/',
      thumbSize: 400,      // Larger thumbnails
      quality: 95,         // Higher quality
      thumbFolderName: '.thumbnails'
    },
    mobile: {
      name: 'mobile',
      root: '/var/www/mobile-images',
      baseurl: 'https://cdn.example.com/mobile/',
      thumbSize: 100,      // Smaller thumbnails
      quality: 75,         // Lower quality
      createThumb: true
    },
    noThumbs: {
      name: 'noThumbs',
      root: '/var/www/raw',
      baseurl: 'https://cdn.example.com/raw/',
      createThumb: false   // Disable thumbnails
    }
  }
}
```

#### Example 4: Different Date Formats per Region

```typescript
{
  // Global: US format
  datetimeFormat: 'M/D/YYYY h:mm A',

  sources: {
    us: {
      name: 'us',
      root: '/var/www/files-us',
      baseurl: 'https://us.example.com/files/',
      // Uses global US format
    },
    eu: {
      name: 'eu',
      root: '/var/www/files-eu',
      baseurl: 'https://eu.example.com/files/',
      datetimeFormat: 'DD.MM.YYYY HH:mm'  // European format
    },
    asia: {
      name: 'asia',
      root: '/var/www/files-asia',
      baseurl: 'https://asia.example.com/files/',
      datetimeFormat: 'YYYY-MM-DD HH:mm:ss'  // ISO format
    }
  }
}
```

#### Example 5: Performance-Optimized Sources

```typescript
{
  // Global: Standard settings
  createThumb: true,
  safeThumbsCountInOneTime: 20,
  countInChunk: 1000,

  sources: {
    archive: {
      name: 'archive',
      root: '/slow-storage/archive',
      baseurl: 'https://archive.example.com/files/',
      createThumb: false,              // No thumbnails for archive
      countInChunk: 50,                // Smaller chunks
      excludeDirectoryNames: ['.git', '.svn', 'node_modules']
    },
    cdn: {
      name: 'cdn',
      root: '/fast-ssd/cdn',
      baseurl: 'https://cdn.example.com/files/',
      safeThumbsCountInOneTime: 100,   // Generate more thumbnails
      countInChunk: 5000               // Larger chunks
    }
  }
}
```

### Implementation Details

The source-level overrides are implemented using JavaScript Proxy:

1. When a source is created, a proxied config object is generated
2. When code accesses `config.params.someProperty`:
   - First checks if `sourceConfig.someProperty` exists and is not undefined
   - If yes, returns the source-specific value
   - Otherwise, returns the global `config.params.someProperty`
3. The `sources` property is explicitly blocked from being overridden

This approach provides:
- **Zero overhead**: No performance impact, Proxy is very fast
- **Type safety**: Full TypeScript support
- **Transparency**: Code doesn't need to know about overrides
- **Flexibility**: Any property can be overridden

### Testing

Comprehensive tests are available in `src/tests/integration/source-config-override.test.ts` covering:
- File extension overrides
- Upload size and strategy overrides
- Thumbnail settings overrides
- Image processing overrides
- Multiple sources with different configurations

Run tests:
```bash
npm test -- source-config-override.test.ts
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

### `generateSvgThumbs`
- **Type**: `boolean`
- **Default**: `true`
- **Used**: ✅ Yes
- **Purpose**: Enable/disable SVG thumbnail generation for non-image files (folders and documents)
- **Usage**: When `true`, generates colored SVG icons for files and folders that are not images. When `false`, returns the original file path without generating SVG thumbnails.

**Example**:
```typescript
{
  generateSvgThumbs: false  // Disable SVG icon generation for non-images
}
```

### `svgThumbWidth`
- **Type**: `number`
- **Default**: `100`
- **Used**: ✅ Yes
- **Purpose**: Width of generated SVG thumbnails in pixels
- **Usage**: Only applies when `generateSvgThumbs` is `true`. Controls the width attribute of the SVG element.

**Example**:
```typescript
{
  svgThumbWidth: 150  // Generate 150px wide SVG icons
}
```

### `svgThumbHeight`
- **Type**: `number`
- **Default**: `100`
- **Used**: ✅ Yes
- **Purpose**: Height of generated SVG thumbnails in pixels
- **Usage**: Only applies when `generateSvgThumbs` is `true`. Controls the height attribute of the SVG element.

**Example**:
```typescript
{
  svgThumbHeight: 150  // Generate 150px tall SVG icons
}
```

### `svgGenerator`
- **Type**: `(file: StatEntry, width: number, height: number) => string`
- **Default**: `undefined` (uses built-in generator)
- **Used**: ✅ Yes
- **Purpose**: Custom function to generate SVG thumbnails for non-image files
- **Usage**: Allows complete customization of SVG thumbnail appearance. Receives file information, desired width/height, and must return SVG string.

**Function signature**:
```typescript
type SvgGenerator = (
  file: StatEntry,      // File/folder information with path, isDirectory, etc.
  width: number,        // Desired SVG width in pixels
  height: number        // Desired SVG height in pixels
) => string;            // Must return valid SVG markup
```

**Example - Simple colored rectangles**:
```typescript
{
  svgGenerator: (file, width, height) => {
    const fileName = file.path.split('/').pop() || 'unknown';
    const color = file.isDirectory ? '#3498db' : '#e74c3c';

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="${color}"/>
      <text x="50%" y="50%" text-anchor="middle" fill="white">${fileName}</text>
    </svg>`;
  }
}
```

**Example - Extension-based colors**:
```typescript
import path from 'path';

{
  svgGenerator: (file, width, height) => {
    const ext = path.extname(file.path).toLowerCase();

    const colors: Record<string, string> = {
      '.pdf': '#e74c3c',
      '.doc': '#3498db',
      '.docx': '#3498db',
      '.txt': '#95a5a6',
      '.zip': '#f39c12'
    };

    const color = colors[ext] || '#7f8c8d';

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${color}" rx="8"/>
      <text x="50%" y="50%" text-anchor="middle" fill="white" font-size="14">
        ${ext.replace('.', '').toUpperCase()}
      </text>
    </svg>`;
  }
}
```

**Example - Using external SVG templates**:
```typescript
import fs from 'fs';
import path from 'path';

{
  svgGenerator: (file, width, height) => {
    const ext = path.extname(file.path).toLowerCase();
    const templatePath = path.join(__dirname, 'svg-templates', `${ext}.svg`);

    if (fs.existsSync(templatePath)) {
      // Use custom template for this extension
      let svg = fs.readFileSync(templatePath, 'utf-8');
      svg = svg.replace('{{width}}', String(width));
      svg = svg.replace('{{height}}', String(height));
      return svg;
    }

    // Fallback to default
    return `<svg width="${width}" height="${height}"><rect fill="#ccc"/></svg>`;
  }
}
```

**Example - Per-source custom generators**:
```typescript
{
  // Global generator for most sources
  svgGenerator: (file, width, height) => {
    return `<svg width="${width}" height="${height}"><rect fill="#3498db"/></svg>`;
  },

  sources: {
    documents: {
      name: 'documents',
      root: '/var/www/docs',
      baseurl: 'https://cdn.example.com/docs/',
      // Override with document-specific generator
      svgGenerator: (file, width, height) => {
        return `<svg width="${width}" height="${height}">
          <rect fill="#2ecc71"/>
          <text x="50%" y="50%" text-anchor="middle" fill="white">DOC</text>
        </svg>`;
      }
    },
    images: {
      name: 'images',
      root: '/var/www/images',
      baseurl: 'https://cdn.example.com/images/',
      generateSvgThumbs: false  // No SVG for images, use real thumbnails
    }
  }
}
```

**Notes**:
- The function is called for each non-image file when listing directories
- Must return valid SVG markup as a string
- Can access file properties: `file.path`, `file.isDirectory`, `file.size`, etc.
- Only called when `generateSvgThumbs` is `true`
- Can be overridden per source (see Source-Level Configuration Overrides)
- Default generator creates colored document icons with extension labels

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

### Multi-Source with Per-Source Overrides
```typescript
{
  // Global defaults
  debug: false,
  allowCrossOrigin: true,
  extensions: ['txt', 'pdf', 'doc'],
  maxUploadFileSize: '10MB',
  createThumb: true,
  thumbSize: 200,
  saveSameFileNameStrategy: 'addNumber',

  sources: {
    // Images: different extensions, smaller upload limit, larger thumbnails
    images: {
      name: 'images',
      title: 'Image Gallery',
      root: '/var/www/images',
      baseurl: 'https://cdn.example.com/images/',
      extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      maxUploadFileSize: '5MB',
      thumbSize: 300,
      quality: 95
    },

    // Videos: video extensions, much larger upload limit, no thumbnails
    videos: {
      name: 'videos',
      title: 'Video Library',
      root: '/var/www/videos',
      baseurl: 'https://cdn.example.com/videos/',
      extensions: ['mp4', 'webm', 'mov'],
      maxUploadFileSize: '500MB',
      createThumb: false
    },

    // Archive: no thumbnails, replace strategy, limited extensions
    archive: {
      name: 'archive',
      title: 'Archive Storage',
      root: '/slow-storage/archive',
      baseurl: 'https://archive.example.com/files/',
      extensions: ['zip', 'tar', 'gz', '7z'],
      createThumb: false,
      saveSameFileNameStrategy: 'replace',
      countInChunk: 50
    },

    // Documents: uses most global settings, only overrides upload size
    documents: {
      name: 'documents',
      title: 'Documents',
      root: '/var/www/docs',
      baseurl: 'https://cdn.example.com/docs/',
      maxUploadFileSize: '50MB'  // Larger for documents
      // Everything else uses global config
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
