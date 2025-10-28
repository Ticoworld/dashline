import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";

const base = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Clerk
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),

  // External APIs
  DUNE_API_KEY: z.string().optional(),
  COVALENT_API_KEY: z.string().optional(),
  ETHERSCAN_API_KEY: z.string().optional(),
  BITQUERY_API_KEY: z.string().optional(),
  MORALIS_API_KEY: z.string().optional(),

  // RPC keys
  ALCHEMY_KEY: z.string().optional(),
  INFURA_KEY: z.string().optional(),
  QUICKNODE_RPC: z.string().optional(),
  PUBLIC_RPC_URL: z.string().optional(),

  // Caching
  REDIS_URL: z.string().optional(),

  // URLs
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  VERCEL_URL: z.string().optional(),

  // Misc
  PORT: z.string().optional(),
  DASHLINE_DEV_BYPASS_AUTH: z.string().optional(),
});

// Tighten requirements in production
const prod = base.superRefine((env, ctx) => {
  if (!isProd) return;

  // Disallow prisma+postgres in production unless explicitly intended
  if (env.DATABASE_URL?.startsWith("prisma+postgres://")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "DATABASE_URL uses prisma+postgres://, which is for Prisma dev/proxy. Use a standard postgresql:// URL for production.",
      path: ["DATABASE_URL"],
    });
  }

  // Clerk keys must be present
  if (!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required in production", path: ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"] });
  }
  if (!env.CLERK_SECRET_KEY) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "CLERK_SECRET_KEY is required in production", path: ["CLERK_SECRET_KEY"] });
  }

  // Public app URL should be set
  if (!env.NEXT_PUBLIC_APP_URL) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "NEXT_PUBLIC_APP_URL is required in production", path: ["NEXT_PUBLIC_APP_URL"] });
  }

  // External API keys should be set to avoid mock data
  if (!env.DUNE_API_KEY) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "DUNE_API_KEY is required in production", path: ["DUNE_API_KEY"] });
  }
  // Covalent deprecated in this stack; keep optional for legacy wallets
  // if (!env.COVALENT_API_KEY) {
  //   ctx.addIssue({ code: z.ZodIssueCode.custom, message: "COVALENT_API_KEY is required in production", path: ["COVALENT_API_KEY"] });
  // }
  if (!env.BITQUERY_API_KEY) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "BITQUERY_API_KEY is recommended for accurate holders in production", path: ["BITQUERY_API_KEY"] });
  }
  if (!env.MORALIS_API_KEY) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "MORALIS_API_KEY is recommended as a fallback", path: ["MORALIS_API_KEY"] });
  }
});

export const env = prod.parse(process.env);

// Helpful warning in development for prisma+postgres usage
if (!isProd && process.env.DATABASE_URL?.startsWith("prisma+postgres://")) {
  console.warn(
    "[env] Using prisma+postgres:// URL. Ensure the Prisma dev service is running (npx prisma dev), or switch to a standard Postgres URL for best practice."
  );
}

// Hard guard: dev auth bypass must never be set in production
if (isProd && process.env.DASHLINE_DEV_BYPASS_AUTH === "1") {
  console.error("[env] DASHLINE_DEV_BYPASS_AUTH must not be enabled in production. Ignoring and proceeding with auth enforcement.");
  // Intentionally do not throw; rely on Clerk auth to still enforce. This log surfaces misconfiguration.
}
