import { z } from "zod";

export const contractAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/i, "Invalid contract address");

export const timeRangeSchema = z.enum(["24h", "7d", "30d", "90d", "all"]);
