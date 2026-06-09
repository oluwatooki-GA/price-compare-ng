import { User } from '@prisma/client';

export interface IUserRepository {
  create(data: { email: string; hashedPassword: string }): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: number): Promise<User | null>;
  existsByEmail(email: string): Promise<boolean>;
}
