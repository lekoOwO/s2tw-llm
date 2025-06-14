// openccConverter.ts
// 對不含歧義字的句子使用 opencc-js 進行簡轉繁

import { initOpenccRust, getConverter } from 'opencc-rust';
await initOpenccRust();
const converter = getConverter();

export async function convertWithOpenCC(sentence: string): Promise<string> {
  return await converter.convert(sentence);
}
