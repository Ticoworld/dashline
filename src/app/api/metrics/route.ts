import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { metrics } from "@/server/services/observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });
  const snap = await metrics.snapshot();
  return NextResponse.json({ metrics: snap });
}
