/*
  Warnings:

  - Added the required column `productUrl` to the `SavedComparison` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
DELETE FROM "SavedComparison";
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SavedComparison" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "searchQuery" TEXT NOT NULL,
    "searchType" TEXT NOT NULL,
    "comparisonData" TEXT NOT NULL,
    "productUrl" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedComparison_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SavedComparison" ("comparisonData", "createdAt", "id", "searchQuery", "searchType", "userId") SELECT "comparisonData", "createdAt", "id", "searchQuery", "searchType", "userId" FROM "SavedComparison";
DROP TABLE "SavedComparison";
ALTER TABLE "new_SavedComparison" RENAME TO "SavedComparison";
CREATE INDEX "SavedComparison_userId_idx" ON "SavedComparison"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
