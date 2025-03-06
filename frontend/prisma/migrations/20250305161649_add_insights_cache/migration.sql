-- CreateTable
CREATE TABLE "InsightsCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "insights" JSONB NOT NULL,
    "financialSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isStale" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "InsightsCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InsightsCache_userId_isStale_createdAt_idx" ON "InsightsCache"("userId", "isStale", "createdAt");

-- AddForeignKey
ALTER TABLE "InsightsCache" ADD CONSTRAINT "InsightsCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
