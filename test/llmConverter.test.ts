import { describe, it, expect } from 'vitest';
import { convertWithLLM, symbolToString, batchLLMConvert } from '../src/ts/llmConverter';

describe('llmConverter mock', () => {
  it('should replace sentence with symbol and restore to mock-繁體', async () => {
    const input = '发现了发';
    const sym = convertWithLLM(input);
    await batchLLMConvert([sym]);
    const result = await symbolToString(sym);
    expect(result).toBe(input + '（mock-繁體）');
  });
});

export {};
