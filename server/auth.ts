import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type {
  ModuleCode,
  PermissionAction,
  RoleCode,
  RolePermissionMatrix,
  SafeUser,
  UserAccount,
} from '../src/types/erp.js';
import { getDb } from './db.js';

const TOKEN_SECRET = process.env.ERP_TOKEN_SECRET || 'vanguard-erp-corporate-hmac-secret-2026';

export function hashPassword(password: string, salt?: string): string {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, usedSalt, 64).toString('hex');
  return `${usedSalt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export interface TokenPayload {
  userId: string;
  roles: RoleCode[];
  departmentId: string;
  exp: number;
}

export function signToken(payload: Omit<TokenPayload, 'exp'>): string {
  const fullPayload: TokenPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 12,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function computeEffectivePermissions(
  roles: RoleCode[],
  matrix: RolePermissionMatrix
): Partial<Record<ModuleCode, PermissionAction[]>> {
  const merged: Partial<Record<ModuleCode, Set<PermissionAction>>> = {};
  for (const role of roles) {
    const roleMap = matrix[role];
    if (!roleMap) continue;
    for (const [mod, actions] of Object.entries(roleMap) as [ModuleCode, PermissionAction[]][]) {
      if (!merged[mod]) merged[mod] = new Set();
      for (const act of actions) {
        merged[mod]!.add(act);
      }
    }
  }
  const result: Partial<Record<ModuleCode, PermissionAction[]>> = {};
  for (const [mod, set] of Object.entries(merged) as [ModuleCode, Set<PermissionAction>][]) {
    result[mod] = Array.from(set);
  }
  return result;
}

export function toSafeUser(user: UserAccount, matrix: RolePermissionMatrix): SafeUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    roles: user.roles,
    departmentId: user.departmentId,
    staffId: user.staffId,
    studentId: user.studentId,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    effectivePermissions: computeEffectivePermissions(user.roles, matrix),
  };
}

export interface AuthenticatedRequest extends Request {
  authUser?: SafeUser;
}

export function hasPermission(
  user: SafeUser,
  module: ModuleCode,
  action: PermissionAction
): boolean {
  if (user.roles.includes('SUPER_ADMIN')) return true;
  const actions = user.effectivePermissions[module];
  return Array.isArray(actions) && actions.includes(action);
}

export function isInstitutionWideUser(user: SafeUser): boolean {
  return user.roles.some((r) => r === 'SUPER_ADMIN' || r === 'COLLEGE_ADMIN' || r === 'PRINCIPAL');
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const token = header.slice(7).trim();
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid token.' });
    return;
  }
  const db = getDb();
  const account = db.users.find((u) => u.id === payload.userId);
  if (!account || account.status !== 'ACTIVE') {
    res.status(403).json({ error: 'Account is suspended or deactivated.' });
    return;
  }
  req.authUser = toSafeUser(account, db.rbacMatrix);
  next();
}

export function requirePermission(module: ModuleCode, action: PermissionAction) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!hasPermission(req.authUser, module, action)) {
      res.status(403).json({
        error: `Access denied: missing "${action}" permission on "${module}".`,
      });
      return;
    }
    next();
  };
}
