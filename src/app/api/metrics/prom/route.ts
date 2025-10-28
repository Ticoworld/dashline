import { NextResponse } from "next/server";
import { metrics } from "@/server/services/observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Simple Prometheus exposition for counters. Protect with METRICS_TOKEN if set.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const expected = process.env.METRICS_TOKEN;
  if (expected && token !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const snap = await metrics.snapshot();
  let body = "";
  for (const [k, v] of Object.entries(snap)) {
    // Sanitize metric name to Prometheus compatible
    const name = k.replace(/[^a-zA-Z0-9_:]/g, "_");
    body += `# TYPE ${name} counter\n`;
    body += `${name} ${v}\n`;
  }
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
