import { Request, Response } from 'express';

/**
 * Handler for creating a new folder
 * GET /?action=folderCreate&source=test&name=newfolder&path=/
 */
export async function folderCreateHandler(
  _: Request,
  res: Response
): Promise<void> {
  res.send({ success: false });
}
