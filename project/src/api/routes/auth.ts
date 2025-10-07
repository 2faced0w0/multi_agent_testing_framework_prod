import { Router, Request, Response } from 'express';
import { authService, requireAuth, requireRoles } from '../middleware/authService';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

interface StoredUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  salt: string;
  roles: string[];
  createdAt: Date;
  lastLogin?: Date;
}

// Simple in-memory user store for demo (replace with database in production)
const users = new Map<string, StoredUser>([
  ['admin', {
    id: 'admin-001',
    username: 'admin',
    email: 'admin@example.com',
    passwordHash: '10cac2e8ca2d2f4c6ffe7cdb0b0a55a2f8b84c5b4b3a4b7e8f9a0b1c2d3e4f5g6',
    salt: '64ea7d2c4c8b9e5a3f4b1c6d8e7f9a0b',
    roles: ['admin', 'operator', 'viewer'],
    createdAt: new Date('2024-01-01')
  }],
  ['operator', {
    id: 'op-001',
    username: 'operator',
    email: 'operator@example.com',
    passwordHash: '20bac3e9ca3d3f5c7ffe8cdb1b1a66a3f9b95c6b5b4a5b8e9f0a1b2c3d4e5f6g7',
    salt: '75ea8d3c5c9b0e6a4f5b2c7d9e8f0a1b',
    roles: ['operator', 'viewer'],
    createdAt: new Date('2024-01-01')
  }],
  ['viewer', {
    id: 'view-001',
    username: 'viewer',
    email: 'viewer@example.com',
    passwordHash: '30cac4e0ca4d4f6c8ffe9cdb2b2a77a4f0ba6c7b6b5a6b9e0f1a2b3c4d5e6f7g8',
    salt: '86ea9d4c6c0b1e7a5f6b3c8d0e9f1a2b',
    roles: ['viewer'],
    createdAt: new Date('2024-01-01')
  }]
]);

/**
 * Login endpoint
 */
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: 'Username and password required',
      statusCode: 400,
      messageId: 'auth.missing_credentials'
    });
  }

  const user = users.get(username);
  if (!user) {
    return res.status(401).json({
      error: 'Invalid credentials',
      statusCode: 401,
      messageId: 'auth.invalid_credentials'
    });
  }

  const isValidPassword = authService.verifyPassword(password, user.passwordHash, user.salt);
  if (!isValidPassword) {
    return res.status(401).json({
      error: 'Invalid credentials',
      statusCode: 401,
      messageId: 'auth.invalid_credentials'
    });
  }

  // Update last login
  user.lastLogin = new Date();

  // Generate tokens
  const accessToken = authService.generateAccessToken({
    id: user.id,
    username: user.username,
    roles: user.roles
  });

  const refreshToken = authService.generateRefreshToken(user.id);

  return res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles,
      lastLogin: user.lastLogin
    },
    expiresIn: process.env.JWT_EXPIRY || '24h'
  });
});

/**
 * Refresh token endpoint
 */
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      error: 'Refresh token required',
      statusCode: 400,
      messageId: 'auth.missing_refresh_token'
    });
  }

  const decoded = authService.verifyRefreshToken(refreshToken);
  if (!decoded) {
    return res.status(401).json({
      error: 'Invalid refresh token',
      statusCode: 401,
      messageId: 'auth.invalid_refresh_token'
    });
  }

  // Find user by ID
  const user = Array.from(users.values()).find(u => u.id === decoded.userId);
  if (!user) {
    return res.status(401).json({
      error: 'User not found',
      statusCode: 401,
      messageId: 'auth.user_not_found'
    });
  }

  // Generate new access token
  const accessToken = authService.generateAccessToken({
    id: user.id,
    username: user.username,
    roles: user.roles
  });

  return res.json({
    accessToken,
    expiresIn: process.env.JWT_EXPIRY || '24h'
  });
});

/**
 * Get current user info
 */
router.get('/me', requireAuth, (req: Request, res: Response) => {
  const auth = (req as any).auth;

  if (auth.type === 'api_key') {
    return res.json({
      type: 'api_key',
      service: auth.service,
      permissions: auth.permissions
    });
  }

  if (auth.type === 'user') {
    const user = Array.from(users.values()).find(u => u.id === auth.userId);
    if (user) {
      return res.json({
        type: 'user',
        id: user.id,
        username: user.username,
        email: user.email,
        roles: user.roles,
        lastLogin: user.lastLogin
      });
    }
  }

  return res.status(404).json({
    error: 'User not found',
    statusCode: 404,
    messageId: 'auth.user_not_found'
  });
});

/**
 * Generate API key (admin only)
 */
router.post('/api-keys', requireAuth, requireRoles(['admin']), (req: Request, res: Response) => {
  const { service, permissions } = req.body;

  if (!service || !Array.isArray(permissions)) {
    return res.status(400).json({
      error: 'Service name and permissions array required',
      statusCode: 400,
      messageId: 'auth.missing_api_key_params'
    });
  }

  const apiKey = authService.generateApiKey(service, permissions);

  return res.json({
    apiKey,
    service,
    permissions,
    created: new Date().toISOString(),
    warning: 'Store this API key securely. It will not be shown again.'
  });
});

/**
 * Create user (admin only)
 */
router.post('/users', requireAuth, requireRoles(['admin']), (req: Request, res: Response) => {
  const { username, email, password, roles } = req.body;

  if (!username || !email || !password || !Array.isArray(roles)) {
    return res.status(400).json({
      error: 'Username, email, password, and roles array required',
      statusCode: 400,
      messageId: 'auth.missing_user_params'
    });
  }

  if (users.has(username)) {
    return res.status(409).json({
      error: 'User already exists',
      statusCode: 409,
      messageId: 'auth.user_exists'
    });
  }

  const { hash, salt } = authService.hashPassword(password);
  const newUser: StoredUser = {
    id: uuidv4(),
    username,
    email,
    passwordHash: hash,
    salt,
    roles,
    createdAt: new Date()
  };

  users.set(username, newUser);

  return res.status(201).json({
    id: newUser.id,
    username: newUser.username,
    email: newUser.email,
    roles: newUser.roles,
    createdAt: newUser.createdAt
  });
});

/**
 * List users (admin only)
 */
router.get('/users', requireAuth, requireRoles(['admin']), (req: Request, res: Response) => {
  const userList = Array.from(users.values()).map(user => ({
    id: user.id,
    username: user.username,
    email: user.email,
    roles: user.roles,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin
  }));

  return res.json({ users: userList });
});

/**
 * Development helper: create default password for demo users
 */
if (process.env.NODE_ENV === 'development') {
  router.get('/dev/default-passwords', (req: Request, res: Response) => {
    return res.json({
      warning: 'This endpoint is only available in development mode',
      users: [
        { username: 'admin', password: 'admin123', roles: ['admin', 'operator', 'viewer'] },
        { username: 'operator', password: 'operator123', roles: ['operator', 'viewer'] },
        { username: 'viewer', password: 'viewer123', roles: ['viewer'] }
      ],
      note: 'Use POST /api/v1/auth/login with these credentials'
    });
  });
}

export default router;