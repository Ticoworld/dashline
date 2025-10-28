import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/server/db";

export type SnapshotPayload<T extends Prisma.JsonValue> = {
  projectId: string;
  metric: string;
  value: T;
  source: string;
  ttlMinutes: number;
  collectedAt?: Date;
  dataEmpty?: boolean;
};

export type MetricSnapshotEntity<T extends Prisma.JsonValue> = {
  projectId: string;
  metric: string;
  value: T;
  source: string;
  dataEmpty: boolean;
  collectedAt: Date;
  ttlMinutes: number;
  expiresAt: Date;
  createdAt: Date;
};

function computeExpiry(collectedAt: Date, ttlMinutes: number): Date {
  const expires = new Date(collectedAt);
  expires.setMinutes(expires.getMinutes() + ttlMinutes);
  return expires;
}

export function isSnapshotExpired(snapshot: Pick<MetricSnapshotEntity<Prisma.JsonValue>, "expiresAt">, now = Date.now()): boolean {
  return snapshot.expiresAt.getTime() <= now;
}

export async function upsertSnapshot<T extends Prisma.JsonValue>({
  projectId,
  metric,
  value,
  source,
  ttlMinutes,
  collectedAt,
  dataEmpty,
}: SnapshotPayload<T>): Promise<MetricSnapshotEntity<T>> {
  const collected = collectedAt ?? new Date();
  const expiresAt = computeExpiry(collected, ttlMinutes);

  const createBase = {
    projectId,
    metric,
    value: value as Prisma.InputJsonValue,
    source,
    ttlMinutes,
    collectedAt: collected,
    expiresAt,
  } as const;
  const updateBase = {
    value: value as Prisma.InputJsonValue,
    source,
    ttlMinutes,
    collectedAt: collected,
    expiresAt,
  } as const;

  // Conditionally include dataEmpty only if provided to avoid runtime errors when client schema isn't yet regenerated
  const createData = (dataEmpty === undefined ? createBase : { ...createBase, dataEmpty: Boolean(dataEmpty) }) as unknown as Parameters<typeof prisma.metricSnapshot.upsert>[0]["create"];
  const updateData = (dataEmpty === undefined ? updateBase : { ...updateBase, dataEmpty: Boolean(dataEmpty) }) as unknown as Parameters<typeof prisma.metricSnapshot.upsert>[0]["update"];

  const record = await prisma.metricSnapshot.upsert({
    where: { projectId_metric: { projectId, metric } },
    create: createData,
    update: updateData,
  });

  return record as unknown as MetricSnapshotEntity<T>;
}

export async function getLatestSnapshot<T extends Prisma.JsonValue = Prisma.JsonValue>(
  projectId: string,
  metric: string
): Promise<MetricSnapshotEntity<T> | null> {
  const snapshot = await prisma.metricSnapshot.findUnique({ where: { projectId_metric: { projectId, metric } } });
  if (!snapshot) return null;
  return snapshot as unknown as MetricSnapshotEntity<T>;
}

export async function getFreshSnapshot<T extends Prisma.JsonValue = Prisma.JsonValue>(
  projectId: string,
  metric: string,
  now = Date.now()
): Promise<MetricSnapshotEntity<T> | null> {
  const snapshot = await getLatestSnapshot<T>(projectId, metric);
  if (!snapshot) return null;
  if (isSnapshotExpired(snapshot, now)) return null;
  return snapshot;
}

export async function deleteSnapshot(projectId: string, metric: string): Promise<void> {
  await prisma.metricSnapshot.delete({ where: { projectId_metric: { projectId, metric } } }).catch(() => {});
}
