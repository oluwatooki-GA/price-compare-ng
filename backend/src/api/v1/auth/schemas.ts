import { z } from 'zod';

export const UserRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const UserLoginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export const TokenSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal('bearer').default('bearer')
});

export const UserResponseSchema = z.object({
  id: z.number(),
  email: z.string(),
  createdAt: z.date()
});

export type UserRegister = z.infer<typeof UserRegisterSchema>;
export type UserLogin = z.infer<typeof UserLoginSchema>;
export type Token = z.infer<typeof TokenSchema>;
export type UserResponse = z.infer<typeof UserResponseSchema>;
