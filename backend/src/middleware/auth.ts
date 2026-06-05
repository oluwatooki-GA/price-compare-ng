import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../config/security';
import { AuthenticationError } from '../shared/errors';

/**
 * Express Request augmented with the decoded JWT payload.
 * Populated by authenticateToken (required) or optionalAuth (best-effort).
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    email: string;
  };
}

/**
 * Pull a Bearer token out of the Authorization header.
 * Returns null if the header is missing or malformed.
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

/**
 * Strict authentication middleware for protected routes.
 * Rejects the request with an AuthenticationError if the token is
 * missing, malformed, or invalid.
 */
export async function authenticateToken(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      throw new AuthenticationError('No authorization header provided');
    }

    const payload = verifyToken(token);
    if (!payload) {
      throw new AuthenticationError('Invalid or expired token');
    }

    req.user = { userId: payload.userId, email: payload.email };
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Lenient authentication middleware.
 * Attaches req.user when a valid Bearer token is present, but never rejects —
 * used by endpoints that work for both anonymous and authenticated callers.
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void {
  try {
    const token = extractBearerToken(req);
    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        req.user = { userId: payload.userId, email: payload.email };
      }
    }
  } catch {
    /* ignore invalid tokens — request proceeds as anonymous */
  }
  next();
}
