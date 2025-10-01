import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function maybeAuth(req: Request, res: Response, next: NextFunction) {
  if (process.env.GUI_AUTH_ENABLED !== 'true') return next();
  const auth = req.headers['authorization'] || '';
  const secret = process.env.GUI_JWT_SECRET || process.env.JWT_SECRET || '';
  if (!secret) return res.status(401).json({ error: 'Auth secret not configured' });
  if (!auth.toLowerCase().startsWith('bearer ')) return res.status(401).json({ error: 'Missing bearer token' });
  const token = auth.substring(7).trim();
  try {
    const payload = jwt.verify(token, secret) as any;
    (req as any).user = payload;
    return next();
  } catch (e: any) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function maybeRequireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.GUI_AUTH_ENABLED !== 'true') return next();
    const user = (req as any).user || {};
    const userRoles: string[] = Array.isArray(user.roles) ? user.roles : [];
    if (!roles || roles.length === 0) return next();
    if (userRoles.some((r) => roles.includes(r))) return next();
    return res.status(403).json({ error: 'Forbidden' });
  };
}
