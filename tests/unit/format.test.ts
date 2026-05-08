import { describe, it, expect } from 'vitest';
import { truncate } from '@/utils/format.ts';

describe('utils/format/truncate', () => {
  it('returns the input unchanged when shorter than max', () => {
    expect(truncate('Tour Eiffel', 40)).toBe('Tour Eiffel');
  });

  it('returns the input unchanged when exactly at max', () => {
    const s = 'a'.repeat(40);
    expect(truncate(s, 40)).toBe(s);
  });

  it('truncates and adds an ellipsis when longer than max', () => {
    const out = truncate('a'.repeat(200), 40);
    expect(out.length).toBe(40);
    expect(out.endsWith('…')).toBe(true);
  });

  it('uses 40 as default max', () => {
    const out = truncate('a'.repeat(100));
    expect(out.length).toBe(40);
  });

  it('trims trailing whitespace before ellipsis', () => {
    const out = truncate('hello world '.repeat(10), 12);
    expect(out.endsWith('…')).toBe(true);
    expect(out.endsWith(' …')).toBe(false);
  });
});
