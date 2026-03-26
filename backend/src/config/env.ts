import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Define the schema for environment variables
const envSchema = z.object({
  // Server configuration
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Database configuration
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // JWT configuration
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  
  // Redis configuration
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  
  // CORS configuration
  CORS_ORIGINS: z.string().min(1, 'CORS_ORIGINS is required').transform((val) => 
    val.split(',').map(origin => origin.trim())
  ),
});

// Validate environment variables
function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      console.error('❌ Environment validation failed:');
      missingVars.forEach(msg => console.error(`  - ${msg}`));
      process.exit(1);
    }
    throw error;
  }
}

// Export validated configuration
export const config = validateEnv();

// Export type for TypeScript
export type Config = z.infer<typeof envSchema>;
