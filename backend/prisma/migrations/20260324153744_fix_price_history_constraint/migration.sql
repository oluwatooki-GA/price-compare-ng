/*
  Warnings:

  - A unique constraint covering the columns `[productUrl,platform]` on the table `PriceHistory` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "PriceHistory_productUrl_platform_recordedAt_key";

-- CreateIndex
CREATE UNIQUE INDEX "PriceHistory_productUrl_platform_key" ON "PriceHistory"("productUrl", "platform");
