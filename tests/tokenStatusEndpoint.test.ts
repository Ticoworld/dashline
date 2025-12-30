import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks for Vitest
const hoisted = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockFindFirst: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  prisma: {
    project: { findUnique: hoisted.mockFindUnique },
    token: { findFirst: hoisted.mockFindFirst },
  },
}));

// Import after mocks
import { GET } from '@/app/api/tokens/status/route';

function makeRequest(url: string) {
  return new Request(url);
}

describe('GET /api/tokens/status', () => {
  beforeEach(() => {
    hoisted.mockFindUnique.mockReset();
    hoisted.mockFindFirst.mockReset();
  });

  it('returns 200 with status for projectId', async () => {
  hoisted.mockFindUnique.mockResolvedValue({ id: 'p1', chain: 'ethereum', contractAddressChecksum: '0xDeaD' });
  hoisted.mockFindFirst.mockResolvedValue({ status: 'pending', lastBlockScanned: BigInt(123), updatedAt: new Date('2025-01-01T00:00:00Z') });

    const res = await GET(makeRequest('http://localhost/api/tokens/status?projectId=p1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ found: true, status: 'pending', lastBlockScanned: 123 });
  });

  it('returns 404 when not found', async () => {
  hoisted.mockFindUnique.mockResolvedValue({ id: 'p1', chain: 'ethereum', contractAddressChecksum: '0xDeaD' });
  hoisted.mockFindFirst.mockResolvedValue(null);

    const res = await GET(makeRequest('http://localhost/api/tokens/status?projectId=p1'));
    expect(res.status).toBe(404);
  });
});
