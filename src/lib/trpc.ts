"use client";
import { httpBatchLink, loggerLink } from "@trpc/client";
import { AppRouter } from "@/server/api/root";
import { createTRPCReact } from "@trpc/react-query";

export const api = createTRPCReact<AppRouter>();

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  // SSR
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export function getTRPCClientConfig() {
  const links = [
    loggerLink({
      enabled: (opts) => (process.env.NODE_ENV === "development" && typeof window !== "undefined") || (opts.direction === "down" && opts.result instanceof Error),
    }),
    httpBatchLink({ url: `${getBaseUrl()}/api/trpc` }),
  ];
  return { links };
}
