// @ts-ignore
import ambiguousMap from './ambiguous-map.json';

// 偵測句子中是否包含可能造成一對多轉換的歧義簡體字
export function containsAmbiguousChar(sentence: string): boolean {
  return Object.keys(ambiguousMap).some(char => sentence.includes(char));
}
