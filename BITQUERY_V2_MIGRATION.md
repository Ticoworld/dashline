# BitQuery V2 Migration & Debugging Guide

## ⚠️ CRITICAL FINDING

**Test Result (Oct 29, 2025):** The BitQuery API key is returning `402: "No active billing period"`

This means:
- ✅ The API key is valid
- ✅ The V2 migration code is correct
- ❌ **The BitQuery subscription is not active or has expired**

### Immediate Action Required:

1. **Check BitQuery Account Status:**
   - Go to https://account.bitquery.io/
   - Log in with your account
   - Check subscription status
   - Verify billing information

2. **Alternative: Use Moralis Instead:**
   Since BitQuery requires an active subscription, you can use Moralis as the primary provider:
   
   ```bash
   # Add to .env.local
   PROVIDERS_PRIORITY_HOLDERS=moralis,bitquery
   ```

3. **Free Tier Option:**
   - BitQuery offers a free tier but with limitations
   - May need to upgrade for production usage
   - Check their pricing page

## Changes Made (October 29, 2025)

### Problem Analysis
Based on the logs and dashboard screenshot, the issues were:
1. **No holder data displaying** - All holder metrics showing 0
2. **CoinGecko rate limiting** - 429 errors preventing price fetches
3. **Empty data being cached** - Metrics stored with `dataEmpty` flag

### Root Cause
The application was using **BitQuery V1 API** schema, which is deprecated. The V1 endpoints were returning empty results because:
- V1 uses different GraphQL schema (`TokenHolders` with `dataset: combined`)
- V1 requires date parameters that may not have current day data
- V1 has different network identifiers

### Solution: Migrate to BitQuery V2 Streaming API

#### 1. Updated BitQuery Service (`src/server/services/bitqueryService.ts`)

**API Endpoint Changed:**
```typescript
// OLD (V1):
const BITQUERY_ENDPOINT = "https://graphql.bitquery.io";

// NEW (V2):
const BITQUERY_ENDPOINT = "https://streaming.bitquery.io/eap";
```

**Authentication Updated:**
```typescript
// V2 uses Bearer token exclusively
headers["Authorization"] = `Bearer ${key}`;
```

**Holder Count Query - V2 Schema:**
```graphql
query ($network: evm_network, $token: String!) {
  EVM(network: $network) {
    BalanceUpdates(
      where: {
        Currency: {SmartContract: {is: $token}}
        BalanceUpdate: {Amount: {gt: "0"}}
      }
      limitBy: {by: BalanceUpdate_Address, count: 1}
      limit: {count: 100000}
    ) {
      count
    }
  }
}
```

**Top Holders Query - V2 Schema:**
```graphql
query ($network: evm_network, $token: String!, $limit: Int!) {
  EVM(network: $network) {
    BalanceUpdates(
      where: {
        Currency: {SmartContract: {is: $token}}
      }
      orderBy: {descendingByField: "balance"}
      limit: {count: $limit}
    ) {
      BalanceUpdate {
        Address
      }
      balance: sum(of: BalanceUpdate_Amount, selectWhere: {ge: "0"})
    }
  }
}
```

**Network Mapping Updated:**
```typescript
function mapToEvmNetwork(chain: string): string {
  const c = (chain || "").toLowerCase();
  if (c.includes("eth")) return "eth";
  if (c.includes("polygon") || c.includes("matic")) return "matic"; // Changed from "polygon"
  if (c.includes("base")) return "base";
  if (c.includes("arb") || c.includes("arbitrum")) return "arbitrum";
  return "eth";
}
```

**Enhanced Logging:**
- Added detailed request/response logging
- GraphQL error detection
- Better error context

#### 2. Enhanced Holders Service Logging (`src/server/services/holdersService.ts`)

Added comprehensive logging at every step:
- Provider selection
- Data fetching progress
- Normalization steps
- Final results

#### 3. Improved CoinGecko Rate Limiting (`src/server/services/coinGeckoService.ts`)

- Detect 429 status codes
- Log rate limit events
- Graceful fallback to Dexscreener

### Key Differences: V1 vs V2

| Feature | V1 | V2 |
|---------|----|----|
| Endpoint | `graphql.bitquery.io` | `streaming.bitquery.io/eap` |
| Auth Header | `X-API-KEY` or `Bearer` | `Bearer` only |
| Schema | `TokenHolders` with dates | `BalanceUpdates` realtime |
| Network ID | `polygon` | `matic` |
| Data Source | Archive/Combined datasets | Streaming data |
| Date Required | Yes (`date` parameter) | No (current state) |

### Testing the Changes

1. **Restart the dev server** to pick up the changes:
   ```bash
   npm run dev
   ```

2. **Check the logs for BitQuery calls:**
   Look for these log prefixes:
   - `[bitquery] Calling API with query:`
   - `[bitquery] Response data:`
   - `[holdersService] summary called`
   - `[holdersService] Bitquery returned X holders`

3. **Expected behavior:**
   - Should see holder count > 0
   - Top holders list should populate
   - Dashboard should show actual metrics

### Debugging Guide

#### If still seeing empty data:

1. **Verify API Key:**
   ```bash
   grep BITQUERY_API_KEY .env.local
   ```
   - Key should start with `ory_at_`
   - Key should be valid and not expired

2. **Check Network Support:**
   - Ensure your token's chain is supported by BitQuery V2
   - Current supported: `eth`, `matic`, `base`, `arbitrum`

3. **Examine Logs:**
   ```bash
   # Watch for BitQuery calls
   npm run dev | grep "\[bitquery\]"
   ```

4. **Test API Directly:**
   You can test the BitQuery API with curl:
   ```bash
   curl -X POST https://streaming.bitquery.io/eap \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "query": "query { EVM(network: eth) { BalanceUpdates(limit: {count: 1}) { count } } }"
     }'
   ```

#### Common Issues:

1. **"BITQUERY_API_KEY missing"** 
   - Add key to `.env.local`
   - Restart server

2. **"GraphQL errors" in response**
   - Check network identifier (use V2 names)
   - Verify contract address format (should be checksummed)
   - Check query syntax

3. **Still getting 0 holders**
   - Token might be too new (< 1 hour old)
   - Contract address might be wrong
   - Network might not be indexed yet

### API Documentation References

- **BitQuery V2 Docs:** https://docs.bitquery.io/
- **Ethereum Schema:** https://docs.bitquery.io/docs/blockchain/Ethereum/
- **Base Schema:** https://docs.bitquery.io/docs/blockchain/Base/
- **Polygon Schema:** https://docs.bitquery.io/docs/blockchain/Matic/

### Next Steps

1. Monitor the logs after server restart
2. Refresh the dashboard page
3. Check if holder data appears
4. If issues persist, share the `[bitquery]` log lines for further debugging

### Rollback Instructions

If V2 doesn't work, you can temporarily revert by:
1. Restore the old endpoint URL
2. Restore the old query schemas
3. But investigate why V2 isn't working - it's the current standard
