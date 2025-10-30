import { JsonRpcProvider } from "ethers";

const envUrls = (process.env.RPC_URLS || process.env.RPC_URL || "").split(",").map(s => s.trim()).filter(Boolean);
let idx = 0;

export function getRpcUrls() {
  return envUrls.length ? envUrls : ["https://rpc.ankr.com/eth"];
}

export function getProvider(): JsonRpcProvider {
  const urls = getRpcUrls();
  const url = urls[idx % urls.length];
  idx = (idx + 1) % urls.length;
  return new JsonRpcProvider(url);
}

export function rotateProvider() {
  return getProvider();
}
