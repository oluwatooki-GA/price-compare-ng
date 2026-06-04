import { hashPassword, comparePassword, createAccessToken } from '../config/security';
import { AuthenticationError, ValidationError } from '../shared/errors';
import { RepositoryContainer } from '../repositories/RepositoryContainer';

export interface User {
  id: number;
  email: string;
  hashedPassword: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AuthService {
  private repositoryContainer: RepositoryContainer;

  constructor(repositoryContainer: RepositoryContainer) {
    this.repositoryContainer = repositoryContainer;
  }

  async registerUser(email: string, password: string): Promise<User> {
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters');
    }
    const userRepository = this.repositoryContainer.getUserRepository();
    const emailExists = await userRepository.existsByEmail(email);
    if (emailExists) throw new ValidationError('Email already registered');
    const hashedPassword = await hashPassword(password);
    return userRepository.create({ email, hashedPassword });
  }

  async authenticateUser(email: string, password: string): Promise<User | null> {
    const userRepository = this.repositoryContainer.getUserRepository();
    const user = await userRepository.findByEmail(email);
    if (!user) return null;
    const isPasswordValid = await comparePassword(password, user.hashedPassword);
    return isPasswordValid ? user : null;
  }

  async createAccessToken(userId: number): Promise<string> {
    const userRepository = this.repositoryContainer.getUserRepository();
    const user = await userRepository.findById(userId);
    if (!user) throw new AuthenticationError('User not found');
    return createAccessToken(userId, user.email);
  }
}
