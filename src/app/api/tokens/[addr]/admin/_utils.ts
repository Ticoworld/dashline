import { prisma } from "@/server/db";
import { getAddress } from "ethers";

export async function resolveToken(addr: string, chain: string) {
  let checksum = addr;
  try { checksum = getAddress(addr); } catch { /* keep raw */ }
  const token = await prisma.token.findFirst({ where: { contractAddressChecksum: checksum, chain: chain.toLowerCase() } });
  return token;
}

export function checkAdmin(req: Request): boolean {
  const key = (req.headers.get("x-admin-key") || "").trim();
  const expected = (process.env.ADMIN_KEY || "").trim();
  if (!expected) return process.env.NODE_ENV !== "production"; // allow in dev when no key set
  return key === expected;
}
