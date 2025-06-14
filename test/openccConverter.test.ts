import { describe, it, expect } from 'vitest';
import { convertWithOpenCC } from '../src/ts/openccConverter';

describe('convertWithOpenCC', () => {
  it('should return the same sentence (mock)', async () => {
    const input = '这是一个测试。';
    const result = await convertWithOpenCC(input);
    expect(result).toBe("這是一個測試。");
  });
});

export {};
