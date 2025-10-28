import { NextResponse } from "next/server";
import { metrics } from "@/server/services/observability";

export const dynamic = "force-dynamic";

export async function GET() {
  const snap = await metrics.snapshot();
  return NextResponse.json({ ok: true, metrics: snap });
}
