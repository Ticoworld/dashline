import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/server/db";
import { refreshSnapshotsForProject } from "@/server/services/snapshotOrchestrator";
import type { ProjectContext, TimeRangeOption } from "@/server/services/metricAssembler";

export const dynamic = "force-dynamic";

const CRON_HEADER = "x-dashline-cron-secret";
const CRON_SECRET = process.env.INTERNAL_CRON_SECRET;
const ALLOWED_RANGES: TimeRangeOption[] = ["24h", "7d", "30d", "90d", "all"];

function parseRanges(value: unknown): TimeRangeOption[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value.filter((v): v is TimeRangeOption => typeof v === "string" && ALLOWED_RANGES.includes(v as TimeRangeOption));
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((part) => part.trim())
      .filter((part): part is TimeRangeOption => ALLOWED_RANGES.includes(part as TimeRangeOption));
  }
  return undefined;
}

async function resolveProjects(projectId?: string | null): Promise<ProjectContext[]> {
  const where = projectId
    ? { id: projectId, isActive: true }
    : { isActive: true };

  const projects = await prisma.project.findMany({
    where,
    select: {
      id: true,
      contractAddress: true,
      chain: true,
    },
  });

  return projects.map((project) => ({
    id: project.id,
    contractAddress: project.contractAddress,
    chain: project.chain,
  }));
}

export async function POST(req: NextRequest) {
  if (CRON_SECRET) {
    const provided = req.headers.get(CRON_HEADER);
    if (provided !== CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const body = (payload !== null && typeof payload === "object" ? (payload as Record<string, unknown>) : {}) as Record<string, unknown>;

  const searchParams = req.nextUrl.searchParams;
  const projectId =
    (typeof body.projectId === "string" ? body.projectId : undefined) ??
    searchParams.get("projectId") ??
    undefined;

  const ranges = parseRanges(body.ranges) ?? parseRanges(searchParams.get("ranges"));

  const force = Boolean(body.force);

  const projects = await resolveProjects(projectId);

  if (projects.length === 0) {
    return NextResponse.json({
      ok: true,
      refreshedProjects: 0,
      results: [],
      message: projectId ? "No active project matched the provided projectId" : "No active projects to refresh",
    });
  }

  const now = Date.now();
  const results = [];
  for (const project of projects) {
    const outcome = await refreshSnapshotsForProject(project, { now, force, ranges });
    results.push(outcome);
  }

  return NextResponse.json({ ok: true, refreshedProjects: results.length, results });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
