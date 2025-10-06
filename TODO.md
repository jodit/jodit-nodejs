# Jodit Connector API Endpoints Implementation

## Progress Tracker

### Core File Operations
- [x] actionFiles - Get list of files
- [x] actionFileUpload - Upload files
- [x] actionFileUploadRemote - Upload file from remote URL
- [x] actionFileRemove - Remove files
- [x] actionFileMove - Move files
- [x] actionFileRename - Rename files
- [x] actionFileDownload - Download file

### Folder Operations
- [x] actionFolders - Get folder tree
- [x] actionFolderCreate - Create new folder
- [x] actionFolderRemove - Remove folder
- [x] actionFolderMove - Move folder
- [x] actionFolderRename - Rename folder

### Image Operations
- [x] actionImageResize - Resize image
- [x] actionImageCrop - Crop image

### Other Operations
- [x] actionPermissions - Get permissions
- [x] actionGetLocalFileByUrl - Resolve local file by URL

### Document Generation (Optional)
- [x] actionGenerateDocx - Generate DOCX document
- [x] actionGeneratePdf - Generate PDF document

## Implementation Order

1. actionFileUpload (most important)
2. actionFileRemove
3. actionFileMove
4. actionFileRename
5. actionFolderCreate
6. actionFolderRemove
7. actionFolderMove
8. actionFolderRename
9. actionFolders
10. actionImageResize
11. actionImageCrop
12. actionPermissions
13. actionFileDownload
14. actionGetLocalFileByUrl
15. actionFileUploadRemote
16. actionGenerateDocx (low priority)
17. actionGeneratePdf (low priority)
