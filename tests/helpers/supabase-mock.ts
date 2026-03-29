import { vi } from "vitest";

export function createMockSupabaseClient() {
  const self: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    in: vi.fn(),
    not: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  // All chainable methods return self
  for (const key of Object.keys(self)) {
    if (key !== "single" && key !== "maybeSingle") {
      self[key].mockReturnValue(self);
    }
  }

  return {
    from: vi.fn().mockReturnValue(self),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    _chain: self,
  };
}
