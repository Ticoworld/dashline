import { describe, it, expect, vi, beforeEach } from 'vitest';

// We will import the SUT after setting up our mocks because it reads some imports at module scope

// Mutable mocks
let mockFindFirst: (args?: unknown) => Promise<unknown>;
let mockFindUnique: ((args?: unknown) => Promise<unknown>) | undefined;
let mockUpsert: (args: unknown) => Promise<unknown>;
let mockGetBlockNumber: () => Promise<number>;

// Mock the rpcManager provider
vi.mock('@/services/indexer/rpcManager', () => {
  return {
    getProvider: () => ({
      getBlockNumber: () => mockGetBlockNumber(),
    }),
  };
});

// Mock prisma dynamically via named export { prisma }
vi.mock('@/server/db', () => {
  return {
    prisma: {
      token: new Proxy({}, {
        get(_target, prop: string) {
          if (prop === 'findFirst') return (args?: unknown) => mockFindFirst(args);
          if (prop === 'findUnique' && mockFindUnique) return (args?: unknown) => mockFindUnique!(args);
          if (prop === 'upsert') return (args: unknown) => mockUpsert(args);
          throw new Error(`Unexpected prisma.token access: ${String(prop)}`);
        }
      })
    }
  };
});

// Import SUT after mocks
import { upsertTokenForIndexing } from '@/server/services/indexerService';

type UpsertArgs = { where: unknown; create?: Record<string, unknown>; update?: Record<string, unknown> };

const VALID_ADDR = '0x000000000000000000000000000000000000dEaD';
const VALID_ADDR_CHECKSUM = '0x000000000000000000000000000000000000dEaD';

beforeEach(() => {
  mockFindUnique = undefined;
  mockFindFirst = async () => null;
  mockUpsert = async (args: unknown) => ({ id: 'new-token', args });
  mockGetBlockNumber = async () => 100000;
});

describe('upsertTokenForIndexing', () => {
  it('returns existing when status is complete (no upsert performed)', async () => {
  const existing = { id: 'tok1', status: 'complete', lastBlockScanned: BigInt(123) };
    mockFindFirst = async () => existing;
    const upsertSpy = vi.fn().mockResolvedValue({});
    mockUpsert = upsertSpy;

    const out = await upsertTokenForIndexing({ contractAddress: VALID_ADDR, chain: 'ethereum' });

    expect(out).toEqual(existing);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('creates a token when none exists (normalizes address, sets pending, computes lastBlockScanned)', async () => {
    mockFindFirst = async () => null;
  const upsertSpy = vi.fn().mockResolvedValue({ id: 'tok-new', status: 'pending' });
    mockUpsert = upsertSpy;
    mockGetBlockNumber = async () => 120000; // head

    await upsertTokenForIndexing({ contractAddress: VALID_ADDR, chain: 'ethereum' });

    expect(upsertSpy).toHaveBeenCalledTimes(1);
  const callArg = upsertSpy.mock.calls[0][0] as UpsertArgs;
    // where key uses checksum + chain
    expect(callArg.where).toEqual({ contractAddressChecksum_chain: { contractAddressChecksum: VALID_ADDR_CHECKSUM, chain: 'ethereum' } });
  // create payload contains normalized fields
  expect(callArg.create).toBeDefined();
  const create = callArg.create as Record<string, unknown>;
  expect(create.contractAddress).toBe(VALID_ADDR_CHECKSUM.toLowerCase());
  expect(create.contractAddressChecksum).toBe(VALID_ADDR_CHECKSUM);
  expect(create.status).toBe('pending');
  expect(typeof create.lastBlockScanned === 'bigint').toBe(true);
  });

  it('updates existing pending token and preserves lastBlockScanned when > 0', async () => {
  const existing = { id: 'tok2', status: 'pending', lastBlockScanned: BigInt(5555) };
    mockFindFirst = async () => existing;
    const upsertSpy = vi.fn().mockResolvedValue({ id: 'tok2', status: 'pending' });
    mockUpsert = upsertSpy;

    await upsertTokenForIndexing({ contractAddress: VALID_ADDR, chain: 'ethereum' });

    expect(upsertSpy).toHaveBeenCalledTimes(1);
  const update = (upsertSpy.mock.calls[0][0] as UpsertArgs).update as Record<string, unknown>;
    expect(update.lastBlockScanned).toBe(existing.lastBlockScanned);
    expect(update.status).toBe('pending');
  });
});
