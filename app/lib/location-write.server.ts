import type { Prisma } from "@prisma/client";
import prisma from "../db.server";
import { BillingVerificationError, getLocatorBilling } from "./billing.server";

/** Serialize all capacity-increasing writes for one locator across server instances. */
export async function withLocationWrite<T>(
  locatorId: string,
  write: (
    tx: Prisma.TransactionClient,
    limit: number | null | Error,
  ) => Promise<T>,
) {
  let limit: number | null | Error;
  try {
    limit = (await getLocatorBilling(locatorId)).limit;
  } catch (error) {
    if (!(error instanceof BillingVerificationError)) throw error;
    limit = error;
  }
  return prisma.$transaction(
    async (tx) => {
      // Updating the parent acquires a PostgreSQL row lock until the transaction ends.
      await tx.locator.update({
        where: { id: locatorId },
        data: { updatedAt: new Date() },
      });
      return write(tx, limit);
    },
    { isolationLevel: "ReadCommitted", maxWait: 10000, timeout: 60000 },
  );
}
