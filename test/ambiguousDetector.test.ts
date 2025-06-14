import { describe, it, expect } from 'vitest';
import { containsAmbiguousChar } from '../src/ts/ambiguousDetector';

describe('containsAmbiguousChar', () => {
  it('should detect ambiguous char', () => {
    expect(containsAmbiguousChar('发现了发')).toBe(true);
    expect(containsAmbiguousChar('这是干的')).toBe(true);
    expect(containsAmbiguousChar('后来')).toBe(true);
    expect(containsAmbiguousChar('吃面')).toBe(true);
  });
  it('should return false if no ambiguous char', () => {
    expect(containsAmbiguousChar('這是一個普通句子')).toBe(false);
  });
});

export {};
