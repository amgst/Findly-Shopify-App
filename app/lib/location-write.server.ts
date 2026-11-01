import type { Prisma } from "@prisma/client";
import prisma from "../db.server";

/** Serialize all capacity-increasing writes for one locator across server instances. */
export function withLocationWrite<T>(
  locatorId: string,
  write: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(
    async (tx) => {
      // Updating the parent acquires a PostgreSQL row lock until the transaction ends.
      await tx.locator.update({
        where: { id: locatorId },
        data: { updatedAt: new Date() },
      });
      return write(tx);
    },
    { isolationLevel: "ReadCommitted", maxWait: 10000, timeout: 60000 },
  );
}
