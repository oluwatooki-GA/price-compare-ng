import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { config } from './env';

const BCRYPT_ROUNDS = 12;

/**
 * Hash a plain text password using bcrypt
 * @param password - Plain text password to hash
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Compare a plain text password with a hashed password
 * @param password - Plain text password
 * @param hashedPassword - Hashed password to compare against
 * @returns True if passwords match, false otherwise
 */
export async function comparePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * JWT token payload interface
 */
export interface TokenPayload {
  userId: number;
  email: string;
}

/**
 * Create a JWT access token for a user
 * @param userId - User ID to include in token
 * @param email - User email to include in token
 * @returns JWT token string
 */
export function createAccessToken(userId: number, email: string): string {
  const payload: TokenPayload = {
    userId,
    email,
  };

  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: '1h' });
}

/**
 * Verify and decode a JWT token
 * @param token - JWT token string to verify
 * @returns Decoded token payload or null if invalid
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Extended Express Request interface with user information
 */
export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

/**
 * Authentication middleware for protected routes
 * Extracts JWT token from Authorization header and validates it
 * Attaches user information to request object if valid
 */
export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      error: 'authentication_required',
      message: 'Authorization header is required',
    });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({
      error: 'invalid_token_format',
      message: 'Authorization header must be in format: Bearer <token>',
    });
    return;
  }

  const token = parts[1];
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({
      error: 'invalid_token',
      message: 'Invalid or expired token',
    });
    return;
  }

  req.user = payload;
  next();
}
