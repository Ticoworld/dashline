import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProjectCard from '@/components/cards/ProjectCard';

const originalFetch = global.fetch;

describe('ProjectCard indexing banner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ found: true, status: 'pending' }),
    } as unknown as Response);
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch as typeof global.fetch;
  });

  it('shows indexing banner when status is not complete', async () => {
    render(
      <ProjectCard
        project={{ id: 'p1', name: 'Token X', chain: 'ethereum', symbol: 'TKN', logoUrl: null }}
        onOpen={() => {}}
        onDelete={() => {}}
      />
    );

    // Allow effect to run and fetch to resolve
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.getByText(/Indexing — data will be ready soon/i)).toBeTruthy();
  });
});
