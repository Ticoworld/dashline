import { prisma } from "@/server/db";

/**
 * Given a Clerk userId, resolve the internal DB user id.
 * - If a user with this clerkId exists, return its id.
 * - Otherwise, fetch minimal profile from Clerk and create a new user.
 *   We set id = clerkId to keep ctx.userId aligned with DB relations.
 */
export async function resolveOrCreateUserFromClerk(clerkId: string): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { clerkId } });
  if (existing) return existing.id;

  const created = await prisma.user.create({
    data: {
      id: clerkId, // align internal id with Clerk id for simpler lookups
      clerkId,
      email: `${clerkId}@users.local`,
      name: null,
      plan: "FREE",
    },
  });
  return created.id;
}
