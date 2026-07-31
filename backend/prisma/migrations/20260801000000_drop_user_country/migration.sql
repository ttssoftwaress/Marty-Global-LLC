-- Signup no longer asks for a country / region, so the column has no writer.
-- A customer's region now comes from their company's `country` alone
-- (modules/admin/customers/customers.service.ts).
ALTER TABLE "user" DROP COLUMN "country";
