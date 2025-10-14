import { Request, Response } from 'express';

export async function permissionsHandler(
  _: Request,
  res: Response
): Promise<void> {
  res.json({
    success: false,
  });
}
