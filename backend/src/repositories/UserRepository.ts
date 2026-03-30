import { PrismaClient, User } from '@prisma/client';
import { Repository } from './base/Repository';
import { IUserRepository } from '../interfaces/IUserRepository';

export class UserRepository extends Repository<User> implements IUserRepository {
  async create(data: { email: string; hashedPassword: string }): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        hashedPassword: data.hashedPassword,
      },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async existsByEmail(email: string): Promise<boolean> {
    const user = await this.findByEmail(email);
    return user !== null;
  }
}
