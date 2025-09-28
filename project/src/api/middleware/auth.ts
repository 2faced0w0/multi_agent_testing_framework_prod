import { Request, Response, NextFunction } from 'express';

export function maybeAuth(_req: Request, _res: Response, next: NextFunction) {
  return next();
}

export function maybeRequireRole(_roles: string[]) {
  return (_req: Request, _res: Response, next: NextFunction) => next();
}
