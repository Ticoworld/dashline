#!/usr/bin/env node
/**
 * BitQuery V2 API Test Script
 * Tests the connection and basic queries to BitQuery V2 Streaming API
 */

import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const BITQUERY_ENDPOINT = 'https://streaming.bitquery.io/eap';
const API_KEY = process.env.BITQUERY_API_KEY;

if (!API_KEY) {
  console.error('❌ BITQUERY_API_KEY not found in .env.local');
  process.exit(1);
}

console.log('🔑 API Key found:', API_KEY.substring(0, 20) + '...');
console.log('🌐 Testing BitQuery V2 API connection...\n');

async function testHolderCount(contractAddress: string, network: string) {
  const query = `
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
  `;

  try {
    console.log(`📊 Testing holder count for ${contractAddress} on ${network}...`);
    const response = await axios.post(
      BITQUERY_ENDPOINT,
      {
        query,
        variables: { network, token: contractAddress }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        timeout: 30000
      }
    );

    console.log('✅ Response received!');
    console.log('Status:', response.status);
    
    if (response.data.errors) {
      console.error('❌ GraphQL Errors:', JSON.stringify(response.data.errors, null, 2));
      return false;
    }

    const holderCount = response.data?.data?.EVM?.BalanceUpdates?.[0]?.count || 0;
    console.log(`👥 Holder Count: ${holderCount}`);
    console.log('📦 Full Response:', JSON.stringify(response.data, null, 2));
    
    return holderCount > 0;
  } catch (error: unknown) {
    const err = error as { message?: string; response?: { status?: number; data?: unknown } };
    console.error('❌ Error:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', JSON.stringify(err.response.data, null, 2));
    }
    return false;
  }
}

async function testTopHolders(contractAddress: string, network: string, limit: number = 10) {
  const query = `
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
  `;

  try {
    console.log(`\n🏆 Testing top ${limit} holders for ${contractAddress} on ${network}...`);
    const response = await axios.post(
      BITQUERY_ENDPOINT,
      {
        query,
        variables: { network, token: contractAddress, limit }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        timeout: 30000
      }
    );

    console.log('✅ Response received!');
    
    if (response.data.errors) {
      console.error('❌ GraphQL Errors:', JSON.stringify(response.data.errors, null, 2));
      return false;
    }

    const holders = response.data?.data?.EVM?.BalanceUpdates || [];
    console.log(`👥 Received ${holders.length} holders`);
    
    if (holders.length > 0) {
      console.log('\n📋 Top 3 Holders:');
      holders.slice(0, 3).forEach((h: { BalanceUpdate?: { Address?: string }; balance?: string | number }, i: number) => {
        console.log(`  ${i + 1}. ${h.BalanceUpdate?.Address} - Balance: ${h.balance}`);
      });
    }
    
    return holders.length > 0;
  } catch (error: unknown) {
    const err = error as { message?: string; response?: { status?: number; data?: unknown } };
    console.error('❌ Error:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', JSON.stringify(err.response.data, null, 2));
    }
    return false;
  }
}

async function main() {
  // Test with the contract from your logs
  const testContract = '0x88e8531c420EE7ddbB77eA2CAf017100b1E0a46f';
  const testNetwork = 'eth';

  console.log('='.repeat(60));
  console.log('BitQuery V2 API Test');
  console.log('='.repeat(60));

  const holderCountSuccess = await testHolderCount(testContract, testNetwork);
  const topHoldersSuccess = await testTopHolders(testContract, testNetwork, 10);

  console.log('\n' + '='.repeat(60));
  console.log('Test Results:');
  console.log('='.repeat(60));
  console.log(`Holder Count Query: ${holderCountSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Top Holders Query: ${topHoldersSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log('='.repeat(60));

  if (holderCountSuccess && topHoldersSuccess) {
    console.log('\n🎉 All tests passed! BitQuery V2 API is working correctly.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
