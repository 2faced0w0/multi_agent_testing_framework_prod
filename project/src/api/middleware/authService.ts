import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface User {
  id: string;
  username: string;
  email: string;
  roles: string[];
  createdAt: Date;
  lastLogin?: Date;
}

export interface AuthTokenPayload {
  userId: string;
  username: string;
  roles: string[];
  iat: number;
  exp: number;
}

export class AuthService {
  private jwtSecret: string;
  private tokenExpiry: string;
  private refreshTokenExpiry: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || process.env.GUI_JWT_SECRET || 'dev-secret-change-in-production';
    this.tokenExpiry = process.env.JWT_EXPIRY || '24h';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
    
    if (this.jwtSecret === 'dev-secret-change-in-production' && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production environment');
    }
  }

  /**
   * Generate access token for user
   */
  generateAccessToken(user: Pick<User, 'id' | 'username' | 'roles'>): string {
    const payload: Omit<AuthTokenPayload, 'iat' | 'exp'> = {
      userId: user.id,
      username: user.username,
      roles: user.roles
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.tokenExpiry,
      issuer: 'matf-auth',
      audience: 'matf-api'
    } as jwt.SignOptions);
  }

  /**
   * Generate refresh token for user
   */
  generateRefreshToken(userId: string): string {
    return jwt.sign(
      { userId, type: 'refresh' },
      this.jwtSecret,
      {
        expiresIn: this.refreshTokenExpiry,
        issuer: 'matf-auth',
        audience: 'matf-api'
      } as jwt.SignOptions
    );
  }

  /**
   * Verify and decode access token
   */
  verifyAccessToken(token: string): AuthTokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'matf-auth',
        audience: 'matf-api'
      }) as AuthTokenPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): { userId: string } | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'matf-auth',
        audience: 'matf-api'
      }) as any;
      
      if (decoded.type !== 'refresh') {
        return null;
      }
      
      return { userId: decoded.userId };
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate API key for service-to-service authentication
   */
  generateApiKey(service: string, permissions: string[]): string {
    const randomBytes = crypto.randomBytes(32).toString('hex');
    const payload = {
      service,
      permissions,
      type: 'api_key',
      generated: new Date().toISOString()
    };
    
    const token = jwt.sign(payload, this.jwtSecret, {
      issuer: 'matf-auth',
      audience: 'matf-api'
    } as jwt.SignOptions);
    
    return `matf_${randomBytes}_${Buffer.from(token).toString('base64')}`;
  }

  /**
   * Verify API key
   */
  verifyApiKey(apiKey: string): { service: string; permissions: string[] } | null {
    try {
      if (!apiKey.startsWith('matf_')) {
        return null;
      }
      
      const parts = apiKey.split('_');
      if (parts.length !== 3) {
        return null;
      }
      
      const tokenB64 = parts[2];
      const token = Buffer.from(tokenB64, 'base64').toString('utf8');
      
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'matf-auth',
        audience: 'matf-api'
      }) as any;
      
      if (decoded.type !== 'api_key') {
        return null;
      }
      
      return {
        service: decoded.service,
        permissions: decoded.permissions
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Hash password for storage
   */
  hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const actualSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, actualSalt, 10000, 64, 'sha512').toString('hex');
    return { hash, salt: actualSalt };
  }

  /**
   * Verify password against hash
   */
  verifyPassword(password: string, hash: string, salt: string): boolean {
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  }
}

// Singleton instance
export const authService = new AuthService();

/**
 * Middleware to require authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (process.env.GUI_AUTH_ENABLED !== 'true') {
    return next();
  }

  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'] as string;

  // Check for API key first
  if (apiKey) {
    const apiKeyResult = authService.verifyApiKey(apiKey);
    if (apiKeyResult) {
      (req as any).auth = {
        type: 'api_key',
        service: apiKeyResult.service,
        permissions: apiKeyResult.permissions
      };
      return next();
    }
  }

  // Check for Bearer token
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = authService.verifyAccessToken(token);
    
    if (decoded) {
      (req as any).auth = {
        type: 'user',
        userId: decoded.userId,
        username: decoded.username,
        roles: decoded.roles
      };
      return next();
    }
  }

  return res.status(401).json({
    error: 'Authentication required',
    message: 'Valid Bearer token or API key required',
    statusCode: 401,
    messageId: 'auth.required'
  });
}

/**
 * Middleware to require specific roles
 */
export function requireRoles(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.GUI_AUTH_ENABLED !== 'true') {
      return next();
    }

    const auth = (req as any).auth;
    
    if (!auth) {
      return res.status(401).json({
        error: 'Authentication required',
        statusCode: 401,
        messageId: 'auth.required'
      });
    }

    // API keys with appropriate permissions pass
    if (auth.type === 'api_key') {
      const hasPermission = allowedRoles.some(role => 
        auth.permissions.includes(role) || auth.permissions.includes('*')
      );
      if (hasPermission) {
        return next();
      }
    }

    // User tokens with appropriate roles pass
    if (auth.type === 'user') {
      const hasRole = allowedRoles.some(role => 
        auth.roles.includes(role) || auth.roles.includes('admin')
      );
      if (hasRole) {
        return next();
      }
    }

    return res.status(403).json({
      error: 'Insufficient permissions',
      required: allowedRoles,
      statusCode: 403,
      messageId: 'auth.forbidden'
    });
  };
}

/**
 * Middleware to require specific permissions (for API keys)
 */
export function requirePermissions(requiredPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.GUI_AUTH_ENABLED !== 'true') {
      return next();
    }

    const auth = (req as any).auth;
    
    if (!auth) {
      return res.status(401).json({
        error: 'Authentication required',
        statusCode: 401,
        messageId: 'auth.required'
      });
    }

    if (auth.type === 'api_key') {
      const hasAllPermissions = requiredPermissions.every(perm => 
        auth.permissions.includes(perm) || auth.permissions.includes('*')
      );
      if (hasAllPermissions) {
        return next();
      }
    }

    if (auth.type === 'user' && auth.roles.includes('admin')) {
      return next();
    }

    return res.status(403).json({
      error: 'Insufficient permissions',
      required: requiredPermissions,
      statusCode: 403,
      messageId: 'auth.forbidden'
    });
  };
}