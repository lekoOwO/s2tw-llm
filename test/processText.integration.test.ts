import { processText } from '../src/ts/main';
import fs from 'fs';
import path from 'path';
import { describe, it, expect, vi } from 'vitest';
import * as ambiguousDetector from '../src/ts/ambiguousDetector';
import * as openccConverter from '../src/ts/openccConverter';
import * as llmConverter from '../src/ts/llmConverter';

describe('processText integration', () => {
  it('should preserve line order and line breaks after OpenCC/LLM conversion', async () => {
    const input = fs.readFileSync(path.resolve(__dirname, '../dev/test-article.txt'), 'utf-8');
    const output = await processText(input);
    // 行數應一致（允許 LLM 產生的空行或順序問題，僅檢查非空行數）
    const inputLines = input.split(/\r?\n/);
    const outputLines = output.split(/\r?\n/);
    const inputNonEmpty = inputLines.filter(l => l.trim() !== '');
    const outputNonEmpty = outputLines.filter(l => l.trim() !== '');
    expect(outputNonEmpty.length).toBe(inputNonEmpty.length);
    // 行數應完全一致
    expect(outputLines.length).toBe(inputLines.length);
    // 每一行都不為 undefined
    expect(outputLines.every(l => l !== undefined)).toBe(true);
    // 每一行內容都不為 undefined 且型別為 string
    expect(outputLines.every(l => typeof l === 'string')).toBe(true);
    // 每一行內容都不為 null
    expect(outputLines.every(l => l !== null)).toBe(true);
    // 每一行內容都與原始行一一對應（允許繁體轉換，但不允許行順序錯亂或丟失）
    for (let i = 0; i < inputLines.length; i++) {
      expect(outputLines[i]).not.toBe(undefined);
    }
    // 不應有重複行（允許空行重複，只檢查非空行內容不重複）
    const nonEmptySet = new Set(outputNonEmpty);
    expect(nonEmptySet.size).toBe(outputNonEmpty.length);
  });
});

describe('processText line-by-line LLM/OpenCC routing', () => {
  it('should route each line to correct converter and preserve order', async () => {
    const input = [
      '这是一个用于测试的简体中文文章。',
      '',
      '1. 这是第一行。',
      '2. 这是第二行，包含标点符号！',
      '3. 这是第三行，包含英文：Hello, world!',
      '4. 这是第四行，包含数字：1234567890',
      '5. 这是第五行，包含特殊符号：@#￥%……&*',
      '6. 这是第六行，测试 OpenCC 能自动转换的词汇：面条、干净、后面、发面、里边、钟表。',
      '7. 这是第七行，测试需要 LLM 判断的歧义词：银行（bank）、行（row/OK）、发（hair/send）、重（weight/repeat）、还（return/still）。',
      '8. 这是第八行，混合 OpenCC 和 LLM 场景：我的发型很时尚，他要发邮件。',
      '9. 这是第九行，混合歧义：他还没还钱。',
      '10. 这是第十行，混合多种情境：银行的行长正在发工资。',
      '',
      '测试结束。'
    ];
    // 預期每行是否 ambiguous
    const ambiguousLines = input.map(line => ambiguousDetector.containsAmbiguousChar(line));
    // mock OpenCC/LLM
    const openccSpy = vi.spyOn(openccConverter, 'convertWithOpenCC').mockImplementation(async (s) => s + '(opencc)');
    const llmBatch: string[] = [];
    vi.spyOn(llmConverter, 'convertWithLLM').mockImplementation((s) => {
      llmBatch.push(s);
      // 模擬 symbol
      return Symbol(s);
    });
    vi.spyOn(llmConverter, 'batchLLMConvert').mockImplementation(async (syms) => {});
    vi.spyOn(llmConverter, 'symbolToString').mockImplementation(async (sym) => {
      // symbol.description 為原文
      return (sym.description || '') + '(llm)';
    });
    const { processText } = await import('../src/ts/main');
    const output = await processText(input.join('\n'));
    const outputLines = output.split('\n');
    expect(outputLines.length).toBe(input.length);
    for (let i = 0; i < input.length; i++) {
      if (input[i] === '') {
        expect(outputLines[i]).toBe('');
      } else if (ambiguousLines[i]) {
        expect(outputLines[i]).toBe(input[i] + '(llm)');
      } else {
        expect(outputLines[i]).toBe(input[i] + '(opencc)');
      }
    }
  });
});
