// Import a CSV into a locator from the command line (same rules as the in-app CSV import).
// Usage: npx tsx scripts/import-csv.ts <file.csv> <shop-domain | email>
import { readFileSync } from "node:fs";
import prisma from "../app/db.server";
import { importCsvText } from "../app/lib/locations.server";

const [file, owner] = process.argv.slice(2);
if (!file || !owner) {
  console.error("Usage: npx tsx scripts/import-csv.ts <file.csv> <shop-domain | email>");
  process.exit(1);
}
const account = await prisma.account.findFirst({
  where: owner.includes("@") ? { email: owner.toLowerCase() } : { shop: owner },
  include: { locator: true },
});
if (!account?.locator) {
  console.error(`No locator found for ${owner}. Open the app once first.`);
  process.exit(1);
}
const result = await importCsvText(account.locator.id, readFileSync(file, "utf8"));
console.log(result);
await prisma.$disconnect();
process.exit(0);
