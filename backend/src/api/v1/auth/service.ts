import { prisma } from '../../../config/database';
import { hashPassword, comparePassword, createAccessToken, verifyToken } from '../../../config/security';
import { AuthenticationError, ValidationError } from '../../../shared/errors';

/**
 * User interface matching Prisma User model
 */
export interface User {
  id: number;
  email: string;
  hashedPassword: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Authentication Service
 * Handles user registration, authentication, and token management
 */
export class AuthService {
  /**
   * Register a new user with email and password
   * @param email - User's email address
   * @param password - User's plain text password
   * @returns Created user object
   * @throws ValidationError if email already exists or password is too short
   */
  async registerUser(email: string, password: string): Promise<User> {
    // Validate password length
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters');
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new ValidationError('Email already registered');
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    
    const user = await prisma.user.create({
      data: {
        email,
        hashedPassword
      }
    });

    return user;
  }

  /**
   * Authenticate a user with email and password
   * @param email - User's email address
   * @param password - User's plain text password
   * @returns User object if credentials are valid, null otherwise
   */
  async authenticateUser(email: string, password: string): Promise<User | null> {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return null;
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.hashedPassword);
    
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  /**
   * Create a JWT access token for a user
   * @param userId - User's ID
   * @returns JWT token string
   */
  async createAccessToken(userId: number): Promise<string> {
    // Get user email for token payload
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      throw new AuthenticationError('User not found');
    }
    
    return createAccessToken(userId, user.email);
  }

  /**
   * Verify a JWT token and return the user ID
   * @param token - JWT token string
   * @returns User ID if token is valid, null otherwise
   */
  verifyToken(token: string): number | null {
    const payload = verifyToken(token);
    return payload ? payload.userId : null;
  }
}
