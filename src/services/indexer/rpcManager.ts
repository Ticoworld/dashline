import { JsonRpcProvider } from "ethers";

let idx = 0;

function resolveRpcUrls(): string[] {
  const envList = (process.env.RPC_URLS || process.env.RPC_URL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const urls: string[] = [...envList];
  if (process.env.QUICKNODE_RPC) urls.push(process.env.QUICKNODE_RPC);
  if (process.env.INFURA_KEY) urls.push(`https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`);
  if (process.env.ALCHEMY_KEY) urls.push(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`);
  if (process.env.PUBLIC_RPC_URL) urls.push(process.env.PUBLIC_RPC_URL);
  // Safe public fallbacks (no key required)
  urls.push("https://cloudflare-eth.com");
  urls.push("https://ethereum.publicnode.com");
  // de-duplicate
  return Array.from(new Set(urls.filter(Boolean)));
}

export function getRpcUrls() {
  const urls = resolveRpcUrls();
  if (idx === 0) {
    console.log("[rpcManager] Using RPC URLs:", urls.join(", "));
  }
  return urls;
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
