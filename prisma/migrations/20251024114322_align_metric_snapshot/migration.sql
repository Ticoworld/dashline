/*
  Warnings:

  - You are about to drop the column `data` on the `MetricSnapshot` table. All the data in the column will be lost.
  - You are about to drop the column `metricType` on the `MetricSnapshot` table. All the data in the column will be lost.
  - You are about to drop the column `timeRange` on the `MetricSnapshot` table. All the data in the column will be lost.
  - You are about to drop the column `timestamp` on the `MetricSnapshot` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[projectId,metric]` on the table `MetricSnapshot` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `expiresAt` to the `MetricSnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `metric` to the `MetricSnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `source` to the `MetricSnapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `value` to the `MetricSnapshot` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."MetricSnapshot_projectId_metricType_timeRange_idx";

-- DropIndex
DROP INDEX "public"."MetricSnapshot_timestamp_idx";

-- AlterTable
ALTER TABLE "MetricSnapshot" DROP COLUMN "data",
DROP COLUMN "metricType",
DROP COLUMN "timeRange",
DROP COLUMN "timestamp",
ADD COLUMN     "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "metric" TEXT NOT NULL,
ADD COLUMN     "source" TEXT NOT NULL,
ADD COLUMN     "ttlMinutes" INTEGER NOT NULL DEFAULT 60,
DROP COLUMN "value",
ADD COLUMN     "value" JSONB NOT NULL;

-- DropEnum
DROP TYPE "public"."MetricType";

-- CreateIndex
CREATE INDEX "MetricSnapshot_metric_collectedAt_idx" ON "MetricSnapshot"("metric", "collectedAt");

-- CreateIndex
CREATE INDEX "MetricSnapshot_projectId_collectedAt_idx" ON "MetricSnapshot"("projectId", "collectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MetricSnapshot_projectId_metric_key" ON "MetricSnapshot"("projectId", "metric");
