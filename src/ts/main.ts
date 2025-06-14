import { containsAmbiguousChar } from './ambiguousDetector';
import { convertWithOpenCC } from './openccConverter';
import { convertWithLLM, symbolToString, batchLLMConvert } from './llmConverter';

export interface ProcessTextOptions {
  onProgress?: (info: { current: number, total: number, type: 'opencc' | 'llm', line: string }) => void;
  batchLLMConvert?: (symbols: symbol[]) => Promise<void>;
}

export async function processText(
  text: string,
  optionsOrOnProgress?: ProcessTextOptions | ((info: { current: number, total: number, type: 'opencc' | 'llm', line: string }) => void)
): Promise<string> {
  // 以 /\r?\n/ 切分，確保每一行不含換行符號
  const lines = text.split(/\r?\n/);
  const converted: (string | symbol)[] = [];
  const llmIndexes: number[] = [];
  const llmSymbols: symbol[] = [];

  let onProgress: ProcessTextOptions['onProgress'] = undefined;
  let customBatchLLMConvert: ProcessTextOptions['batchLLMConvert'] = undefined;
  if (typeof optionsOrOnProgress === 'function') {
    onProgress = optionsOrOnProgress;
  } else if (optionsOrOnProgress) {
    onProgress = optionsOrOnProgress.onProgress;
    customBatchLLMConvert = optionsOrOnProgress.batchLLMConvert;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === '') {
      converted[i] = '';
      continue;
    }
    if (containsAmbiguousChar(line)) {
      onProgress?.({ current: i + 1, total: lines.length, type: 'llm', line });
      const sym = convertWithLLM(line, i); // 傳入 index
      converted[i] = sym;
      llmIndexes.push(i);
      llmSymbols.push(sym);
    } else {
      onProgress?.({ current: i + 1, total: lines.length, type: 'opencc', line });
      converted[i] = await convertWithOpenCC(line);
    }
  }

  if (llmSymbols.length > 0) {
    if (customBatchLLMConvert) {
      await customBatchLLMConvert(llmSymbols);
    } else {
      await batchLLMConvert(llmSymbols);
    }
    for (let j = 0; j < llmIndexes.length; j++) {
      const idx = llmIndexes[j];
      converted[idx] = await symbolToString(llmSymbols[j]);
    }
  }

  // 用 \n join，保留原始分行
  let result = converted.join('\n');
  return result;
}
