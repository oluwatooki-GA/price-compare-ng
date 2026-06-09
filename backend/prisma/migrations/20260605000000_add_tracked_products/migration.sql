-- CreateTable
CREATE TABLE "TrackedProduct" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "productUrl" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "imageUrl" TEXT,
    "lastKnownPrice" DOUBLE PRECISION,
    "alertThreshold" DOUBLE PRECISION,
    "alertEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastCheckedAt" TIMESTAMP(3),

    CONSTRAINT "TrackedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackedPriceHistory" (
    "id" SERIAL NOT NULL,
    "trackedProductId" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "availability" BOOLEAN NOT NULL DEFAULT true,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackedPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrackedProduct_userId_idx" ON "TrackedProduct"("userId");

-- CreateIndex
CREATE INDEX "TrackedProduct_isActive_idx" ON "TrackedProduct"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedProduct_userId_productUrl_key" ON "TrackedProduct"("userId", "productUrl");

-- CreateIndex
CREATE INDEX "TrackedPriceHistory_trackedProductId_recordedAt_idx" ON "TrackedPriceHistory"("trackedProductId", "recordedAt");

-- AddForeignKey
ALTER TABLE "TrackedProduct" ADD CONSTRAINT "TrackedProduct_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedPriceHistory" ADD CONSTRAINT "TrackedPriceHistory_trackedProductId_fkey" FOREIGN KEY ("trackedProductId") REFERENCES "TrackedProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
