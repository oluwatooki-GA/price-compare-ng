import { PrismaClient } from '@prisma/client';

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export class TransactionManager {
  constructor(private prisma: PrismaClient) {}

  async execute<T>(callback: (tx: TxClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(callback);
  }

  getTransactionalClient(tx: TxClient): TxClient {
    return tx;
  }
}
