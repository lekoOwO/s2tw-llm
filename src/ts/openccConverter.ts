// openccConverter.ts
// 對不含歧義字的句子使用 opencc-js 進行簡轉繁

// @ts-ignore
import { converter } from "../js/opencc-rust-lib/opencc-rust.mjs";

export async function convertWithOpenCC(sentence: string): Promise<string> {
  return await converter.convert(sentence);
}
