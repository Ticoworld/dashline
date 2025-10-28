import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Clerk requires middleware to be present so that auth() in server components
// can read the request's auth state. This middleware will run for matched paths
// and simply continue unless you want to add custom logic (e.g., org routing).
export default clerkMiddleware(async (auth, req) => {
	// Convenience redirect: if user is signed in and hits "/" or "/sign-in", send to dashboard.
	const { userId } = await auth();
	const url = req.nextUrl;
	const pathname = url.pathname;
	if (userId && (pathname === "/" || pathname.startsWith("/sign-in"))) {
		const dashUrl = new URL("/dashboard", url);
		return NextResponse.redirect(dashUrl);
	}

	// Generate a per-request nonce. UUID is sufficient entropy and CSP allows any opaque string.
	const nonce = crypto.randomUUID();
	// Forward the nonce to the app so Next can apply it to inline scripts/styles it generates
	const requestHeaders = new Headers(req.headers);
	requestHeaders.set("x-nonce", nonce);
	const res = NextResponse.next({ request: { headers: requestHeaders } });
	// Basic security headers (non-breaking defaults)
	res.headers.set("X-Content-Type-Options", "nosniff");
	res.headers.set("X-Frame-Options", "SAMEORIGIN");
	res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	res.headers.set("X-DNS-Prefetch-Control", "off");
		// Enforced CSP; use per-response nonce. Keep report-uri for monitoring.
		const isProd = process.env.NODE_ENV === "production";
			const scriptSrc = [
			"'self'",
			`'nonce-${nonce}'`,
			// Clerk resources
			"https://*.clerk.com",
			// Clerk also serves assets and runtime from *.clerk.dev and *.clerk.accounts.dev
			"https://*.clerk.dev",
			"https://*.clerk.accounts.dev",
				// broader dev allowance for accounts.dev
				"https://*.accounts.dev",
		];
		if (!isProd) {
			// Dev tooling sometimes needs eval; allow only in dev
			scriptSrc.push("'unsafe-eval'");
			// Allow inline during dev to reduce friction
			scriptSrc.push("'unsafe-inline'");
		}
			const connectSrc = [
			"'self'",
			"https://*.clerk.com",
			"https://*.clerk.dev",
			"https://*.clerk.accounts.dev",
		];
		if (!isProd) {
			connectSrc.push("ws:"); // HMR/Dev websockets
			// Broaden in dev to catch any transient Clerk hosts
			connectSrc.push("https://*.accounts.dev");
		}
			const imgSrc = ["'self'", "data:", "https:"];
			// Allow Clerk to create web workers using blob: in development
			const workerSrc = ["'self'"];
			if (!isProd) {
				workerSrc.push("blob:");
			}
				const styleSrc = ["'self'"];
				const styleSrcElem = ["'self'"];
				if (isProd) {
					styleSrc.push(`'nonce-${nonce}'`);
					styleSrcElem.push(`'nonce-${nonce}'`);
				} else {
					// In development allow inline styles (omit nonce so it's not ignored)
					styleSrc.push("'unsafe-inline'");
					styleSrcElem.push("'unsafe-inline'");
				}
		const frameSrc = ["https://*.clerk.com", "https://*.clerk.dev", "https://*.clerk.accounts.dev"]; // Clerk widgets iframes
		if (!isProd) {
			frameSrc.push("https://*.accounts.dev");
		}

				const directives = [
			`default-src 'self'`,
			`base-uri 'self'`,
			`object-src 'none'`,
			`frame-src ${frameSrc.join(' ')}`,
					`script-src ${scriptSrc.join(' ')}`,
					`script-src-elem ${scriptSrc.join(' ')}`,
					`style-src ${styleSrc.join(' ')}`,
					`style-src-elem ${styleSrcElem.join(' ')}`,
				`worker-src ${workerSrc.join(' ')}`,
			`img-src ${imgSrc.join(' ')}`,
			`connect-src ${connectSrc.join(' ')}`,
			`form-action 'self'`,
			`upgrade-insecure-requests`,
			`report-uri /api/csp-report`,
		];

		res.headers.set("Content-Security-Policy", directives.join("; "));
	return res;
});

// Ensure the middleware runs on dashboard and API routes that need auth context.
export const config = {
	matcher: [
		// Protect dashboard pages
		"/dashboard/:path*",
		// tRPC endpoint may need auth context as well
		"/api/trpc/:path*",
		// Run on root and sign-in to support afterAuth redirect
		"/",
		"/sign-in/:path*",
		// Optionally include any other routes that should have Clerk context
	],
};

