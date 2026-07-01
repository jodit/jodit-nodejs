---
title: API Reference
description: Complete API endpoints reference for Jodit Connector Node.js.
---

# API Reference

This page documents all available API endpoints.

## GET /?action=files

Get list of files from source.

**Parameters:**
- `action` (required) - action name ("files")
- `source` (optional) - source name
- `path` (optional) - path within source (default: "/")
- `mods` (optional) - modifiers ("withFolders" to include folders)

**Examples:**

```bash
# Get all files from "test" source
curl "http://localhost:8081/?action=files&source=test"

# Get files with folders
curl "http://localhost:8081/?action=files&source=test&mods=withFolders"

# Get files from subfolder
curl "http://localhost:8081/?action=files&source=test&path=/subfolder"
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
        "baseurl": "http://localhost:8081/files/test/",
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

## GET /ping

Health check endpoint.

**Response:**
```json
{
  "success": true
}
```

## POST /?action=fileUpload

Upload one or more files.

**Parameters:**
- `action` (required) - action name ("fileUpload")
- `source` (optional) - source name
- `path` (optional) - destination path within source

**Body:**
- Multipart form data with file(s)

## POST /?action=fileUploadRemote

Upload file from remote URL.

**Parameters:**
- `action` (required) - action name ("fileUploadRemote")
- `source` (optional) - source name
- `path` (optional) - destination path
- `url` (required) - remote file URL

> **SSRF protection:** `url` must be `http`/`https`, and its host must not resolve
> to a loopback / private / link-local address (`127.0.0.0/8`, `10/8`,
> `172.16/12`, `192.168/16`, `169.254/16`, `::1`, `fc00::/7`, `localhost`, …).
> Redirects are followed manually and **each hop is re-checked**, so a public URL
> that 302s to an internal address is still blocked. Set
> `allowPrivateNetworkUploads: true` in the config to permit private hosts on a
> trusted internal setup.

## POST /?action=fileRemove

Remove one or more files.

**Parameters:**
- `action` (required) - action name ("fileRemove")
- `source` (optional) - source name
- `path` (optional) - path within source
- `name` (required) - file name or array of file names

## POST /?action=fileMove

Move files to another location.

**Parameters:**
- `action` (required) - action name ("fileMove")
- `source` (optional) - source name
- `path` (optional) - source path
- `dest` (required) - destination path
- `name` (required) - file name or array of file names

## POST /?action=fileRename

Rename a file.

**Parameters:**
- `action` (required) - action name ("fileRename")
- `source` (optional) - source name
- `path` (optional) - path within source
- `name` (required) - current file name
- `newname` (required) - new file name

## POST /?action=folderCreate

Create a new folder.

**Parameters:**
- `action` (required) - action name ("folderCreate")
- `source` (optional) - source name
- `path` (optional) - parent path
- `name` (required) - folder name

## POST /?action=folderRemove

Remove a folder.

**Parameters:**
- `action` (required) - action name ("folderRemove")
- `source` (optional) - source name
- `path` (optional) - parent path
- `name` (required) - folder name

## POST /?action=folderMove

Move a folder.

**Parameters:**
- `action` (required) - action name ("folderMove")
- `source` (optional) - source name
- `path` (optional) - source path
- `dest` (required) - destination path
- `name` (required) - folder name

## POST /?action=folderRename

Rename a folder.

**Parameters:**
- `action` (required) - action name ("folderRename")
- `source` (optional) - source name
- `path` (optional) - parent path
- `name` (required) - current folder name
- `newname` (required) - new folder name

## GET /?action=folders

Get folder tree.

**Parameters:**
- `action` (required) - action name ("folders")
- `source` (optional) - source name
- `path` (optional) - starting path

## GET /?action=permissions

Get current user permissions.

**Parameters:**
- `action` (required) - action name ("permissions")

## POST /?action=imageResize

Resize an image.

**Parameters:**
- `action` (required) - action name ("imageResize")
- `source` (optional) - source name
- `path` (optional) - path within source
- `name` (required) - image file name
- `newname` (optional) - new file name (default: overwrites original)
- `box` (required) - width and height (e.g., "800,600")

## POST /?action=imageCrop

Crop an image.

**Parameters:**
- `action` (required) - action name ("imageCrop")
- `source` (optional) - source name
- `path` (optional) - path within source
- `name` (required) - image file name
- `newname` (optional) - new file name (default: overwrites original)
- `box` (required) - crop coordinates "x,y,width,height"

## POST /?action=imageSave

Save a client-side edited image. Unlike `imageResize`/`imageCrop` (which
re-process an existing server file from box parameters), this accepts the final
edited image **bytes** — crop, filters, finetune and annotations already baked
in — as a multipart file field and writes them verbatim. Used by the client-side
image editor.

**Parameters:**
- `action` (required) - action name ("imageSave")
- `source` (optional) - source name
- `path` (optional) - path within source
- `name` (optional) - original file name; overwritten in place when `newname` is omitted
- `newname` (optional) - target file name to "save as"; when omitted, `name` is overwritten
- file field (required) - the edited image bytes, sent as multipart `files` (or `files[0]`)

**Response:**
```json
{
  "success": true,
  "data": {
    "code": 220,
    "newPath": "http://localhost:8081/files/test/photo-edited.png",
    "name": "photo-edited.png"
  }
}
```

**Example:**
```bash
curl -X POST "http://localhost:8081/?action=imageSave&source=test&newname=photo-edited.png" \
  -F "files[0]=@edited.png;type=image/png"
```

## POST /?action=imageLoad

Return an image file as a base64 **data URL** through the CORS-enabled JSON API.
The raw file host often serves images without CORS headers, so a browser on a
different origin (a dev server, the image editor) can't `fetch()` them directly;
this routes the bytes through the connector API instead.

**Parameters:**
- `action` (required) - action name ("imageLoad")
- `source` (optional) - source name
- `path` (optional) - path within source
- `name` (required) - image file name

**Response:**
```json
{
  "success": true,
  "data": {
    "code": 220,
    "content": "data:image/jpeg;base64,/9j/4AAQ…",
    "name": "photo.jpg"
  }
}
```

## POST /?action=generatePdf

Generate PDF from HTML content.

**Parameters:**
- `action` (required) - action name ("generatePdf")
- `html` (required) - HTML content to convert

## POST /?action=generateDocx

Generate DOCX from HTML content.

**Parameters:**
- `action` (required) - action name ("generateDocx")
- `html` (required) - HTML content to convert

## OpenAPI Specification

Complete OpenAPI specification is available at:

- **Swagger UI**: [https://jodit.github.io/jodit-nodejs/](https://jodit.github.io/jodit-nodejs/)
- **YAML**: [https://jodit.github.io/jodit-nodejs/openapi.yaml](https://jodit.github.io/jodit-nodejs/openapi.yaml)
- **JSON**: [https://jodit.github.io/jodit-nodejs/openapi.json](https://jodit.github.io/jodit-nodejs/openapi.json)

## Next Steps

- **[Authentication](./authentication.md)** - Set up authentication methods
- **[Access Control](./access-control.md)** - Configure permissions and ACL rules
- **[Configuration](./config.md)** - Explore all configuration options
