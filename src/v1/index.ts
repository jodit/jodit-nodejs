import { filesHandler } from './files/handler';
import { fileUploadHandler } from './file-upload/handler';
import { fileRemoveHandler } from './file-remove/handler';
import { fileMoveHandler } from './file-move/handler';
import { fileRenameHandler } from './file-rename/handler';
import { fileDownloadHandler } from './file-download/handler';
import { getLocalFileByUrlHandler } from './get-local-file-by-url/handler';
import { fileUploadRemoteHandler } from './file-upload-remote/handler';
import { folderCreateHandler } from './folder-create/handler';
import { folderRemoveHandler } from './folder-remove/handler';
import { folderMoveHandler } from './folder-move/handler';
import { folderRenameHandler } from './folder-rename/handler';
import { foldersHandler } from './folders/handler';
import { permissionsHandler } from './permissions/handler';
import { imageResizeHandler } from './image-resize/handler';
import { imageCropHandler } from './image-crop/handler';
import { generateDocxHandler } from './generate-docx/handler';
import { generatePdfHandler } from './generate-pdf/handler';

export const actions = {
  files: filesHandler,
  fileUpload: fileUploadHandler,
  fileRemove: fileRemoveHandler,
  fileMove: fileMoveHandler,
  fileRename: fileRenameHandler,
  fileDownload: fileDownloadHandler,
  getLocalFileByUrl: getLocalFileByUrlHandler,
  fileUploadRemote: fileUploadRemoteHandler,
  folderCreate: folderCreateHandler,
  folderRemove: folderRemoveHandler,
  folderMove: folderMoveHandler,
  folderRename: folderRenameHandler,
  folders: foldersHandler,
  permissions: permissionsHandler,
  imageResize: imageResizeHandler,
  imageCrop: imageCropHandler,
  generateDocx: generateDocxHandler,
  generatePdf: generatePdfHandler
} as const;
