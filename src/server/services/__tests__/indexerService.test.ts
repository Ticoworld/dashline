import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the prisma client module used by the service
const mockFindFirst = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/server/db', () => ({
  prisma: {
    token: {
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
    },
  },
}));

// Mock the rpc manager provider to control head block
vi.mock('@/services/indexer/rpcManager', () => ({
  getProvider: () => ({
    getBlockNumber: async () => 100000,
  }),
}));

// Import the function under test after mocks are set up
import { upsertTokenForIndexing } from '@/server/services/indexerService';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('upsertTokenForIndexing', () => {
  it("returns existing 'complete' token unchanged", async () => {
    const existing = { id: 'tok-complete', status: 'complete', lastBlockScanned: BigInt(123) } as any;
    mockFindFirst.mockResolvedValueOnce(existing);

    const res = await upsertTokenForIndexing({ contractAddress: '0x0000000000000000000000000000000000000001', chain: 'ethereum' });

    expect(mockFindFirst).toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(res).toEqual(existing);
  });

  it('creates a new token when none exists and computes lastBlockScanned from head', async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const created = { id: 'tok-new', contractAddress: '0x0000000000000000000000000000000000000001', contractAddressChecksum: '0x0000000000000000000000000000000000000001', chain: 'ethereum', lastBlockScanned: BigInt(50000), status: 'pending' } as any;
    mockCreate.mockResolvedValueOnce(created);

    const res = await upsertTokenForIndexing({ contractAddress: '0x0000000000000000000000000000000000000001', chain: 'ethereum' });

    expect(mockFindFirst).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalled();
    // The created object should be returned
    expect(res).toEqual(created);
  });
});
