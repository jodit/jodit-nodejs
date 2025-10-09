import type { Request, Response } from 'express';

export function pingHandler(_req: Request, res: Response): void {
  res.json({ success: true });
}
