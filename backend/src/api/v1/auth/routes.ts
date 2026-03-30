import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from './service';
import { UserRegisterSchema, UserLoginSchema } from './schemas';
import { AuthenticationError, ValidationError } from '../../../shared/errors';
import { verifyToken } from '../../../config/security';
import { unauthenticatedLimiter, authenticatedLimiter } from '../../../middleware/rateLimiter';
import { RepositoryContainer } from '../../../repositories/RepositoryContainer';
import { prisma } from '../../../config/database';

const router = Router();

// Initialize repository container and service
const repositoryContainer = RepositoryContainer.getInstance(prisma);
const authService = new AuthService(repositoryContainer);

/**
 * Extended Request interface with user property
 */
interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    email: string;
  };
}

/**
 * Authentication middleware for protected routes
 * Verifies JWT token from Authorization header
 */
async function authenticateToken(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw new AuthenticationError('No authorization header provided');
    }

    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new AuthenticationError('Invalid authorization header format');
    }

    const token = parts[1];
    const payload = verifyToken(token);
    
    if (!payload) {
      throw new AuthenticationError('Invalid or expired token');
    }

    // Attach user info to request
    req.user = {
      userId: payload.userId,
      email: payload.email
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: password123
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   $ref: '#/components/schemas/Token'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: User already exists
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/register', unauthenticatedLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request body
    const validationResult = UserRegisterSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      throw new ValidationError(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
    }

    const { email, password } = validationResult.data;

    // Register user
    const user = await authService.registerUser(email, password);

    // Create access token
    const accessToken = await authService.createAccessToken(user.id);

    // Return user and token
    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt
      },
      accessToken,
      tokenType: 'bearer'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   $ref: '#/components/schemas/Token'
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/login', unauthenticatedLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request body
    const validationResult = UserLoginSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      throw new ValidationError(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
    }

    const { email, password } = validationResult.data;

    // Authenticate user
    const user = await authService.authenticateUser(email, password);

    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Create access token
    const accessToken = await authService.createAccessToken(user.id);

    // Return user and token
    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt
      },
      accessToken,
      tokenType: 'bearer'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /auth/me
 * Get current authenticated user information
 * Protected route - requires valid JWT token
 * Rate limited: 60 requests per minute per user (authenticated)
 */
router.get('/me', authenticatedLimiter, authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    // Return user  information from token
    res.status(200).json({
      id: req.user.userId,
      email: req.user.email
    });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter, authenticateToken };
