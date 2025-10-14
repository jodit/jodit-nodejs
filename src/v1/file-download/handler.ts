import type { Request, Response } from 'express';

export async function fileDownloadHandler(
  _: Request,
  res: Response
): Promise<void> {
  res.send({
    success: false
  });
}
