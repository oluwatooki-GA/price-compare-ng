import { hashPassword, comparePassword, createAccessToken } from '../../../config/security';
import { AuthenticationError, ValidationError } from '../../../shared/errors';
import { RepositoryContainer } from '../../../repositories/RepositoryContainer';

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
  private repositoryContainer: RepositoryContainer;

  constructor(repositoryContainer: RepositoryContainer) {
    this.repositoryContainer = repositoryContainer;
  }

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

    const userRepository = this.repositoryContainer.getUserRepository();

    // Check if user already exists
    const emailExists = await userRepository.existsByEmail(email);

    if (emailExists) {
      throw new ValidationError('Email already registered');
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    const user = await userRepository.create({ email, hashedPassword });

    return user;
  }

  /**
   * Authenticate a user with email and password
   * @param email - User's email address
   * @param password - User's plain text password
   * @returns User object if credentials are valid, null otherwise
   */
  async authenticateUser(email: string, password: string): Promise<User | null> {
    const userRepository = this.repositoryContainer.getUserRepository();

    // Find user by email
    const user = await userRepository.findByEmail(email);

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
    const userRepository = this.repositoryContainer.getUserRepository();

    // Get user email for token payload
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    return createAccessToken(userId, user.email);
  }
}
