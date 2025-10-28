-- Add dataEmpty boolean column to MetricSnapshot
ALTER TABLE "MetricSnapshot" ADD COLUMN IF NOT EXISTS "dataEmpty" BOOLEAN NOT NULL DEFAULT false;