import DashboardLayout from "@/components/layout/DashboardLayout";
import { DashboardProvider } from "@/context/DashboardContext";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Dashboard - Dashline" };

export default async function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  // Dev bypass: set DASHLINE_DEV_BYPASS_AUTH=1 in your environment to skip auth locally.
  if (process.env.DASHLINE_DEV_BYPASS_AUTH === "1") {
    // Render with a DashboardProvider — downstream components can use client-side auth or
    // read this as a dev session indicator via DashboardContext if needed.
    return (
      <DashboardProvider>
        <DashboardLayout>{children}</DashboardLayout>
      </DashboardProvider>
    );
  }

  // Server-side auth using Clerk's helper. If there's no authenticated user, redirect to sign-in.
  // `auth()` reads cookies/headers from the current request in server components.
  const authResult = await auth();
  const userId = (authResult as { userId?: string | null } | undefined)?.userId ?? null;

  if (!userId) {
    // If unauthenticated, redirect to your sign-in page. Adjust path if you use Clerk's default.
    redirect("/sign-in");
  }

  // Authenticated: render dashboard. We intentionally don't pass the user through props to avoid
  // leaking PII; client components can call Clerk's client-side hooks if needed.
  return (
    <DashboardProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </DashboardProvider>
  );
}
