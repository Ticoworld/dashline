import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const report = body?.["csp-report"] || body?.["csp_report"] || body;
    // Log minimal info – avoid logging full URLs or referrers in production
    const entry = {
      violatedDirective: report?.["violated-directive"] || report?.violatedDirective,
      effectiveDirective: report?.["effective-directive"] || report?.effectiveDirective,
      blockedURI: report?.["blocked-uri"] ? String(report?.["blocked-uri"]).slice(0, 120) : undefined,
      sourceFile: report?.["source-file"] ? String(report?.["source-file"]).slice(0, 120) : undefined,
      disposition: report?.disposition,
    };
    if (process.env.NODE_ENV !== "production") {
      console.warn("[csp-report]", entry);
    }
  } catch {
    // ignore parse errors
  }
  return new NextResponse(null, { status: 204 });
}
