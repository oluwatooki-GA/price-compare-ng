/*
  Warnings:

  - A unique constraint covering the columns `[productUrl,platform,recordedAt]` on the table `PriceHistory` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,productUrl]` on the table `SavedComparison` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "PriceHistory_productUrl_platform_recordedAt_key" ON "PriceHistory"("productUrl", "platform", "recordedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SavedComparison_userId_productUrl_key" ON "SavedComparison"("userId", "productUrl");
