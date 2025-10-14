import { Request, Response } from 'express';
import * as changeKeys from 'change-case';
import { DEFAULT_RULES } from '../../helpers/access-control';

export async function permissionsHandler(
  req: Request,
  res: Response
): Promise<void> {
  const config = req.app.locals.config;
  const result: Record<string, boolean> = {};

  const [source] = await config.getSources({
    source: req.context.source,
    action: req.context.action
  });

  for (const key in DEFAULT_RULES) {
    if (/^[A-Z_]+$/.test(key)) {
      let allow = false;

      try {
        await config.access.checkPermission(
          await config.getUserRole(),
          key,
          await source!.getPath(req.context.path)
        );
        allow = true;
      } catch {
        allow = false;
      }

      result[changeKeys.camelCase('allow_' + key)] = allow;
    }
  }

  res.json({
    success: true,
    data: {
      code: 220,
      permissions: result
    }
  });
}
