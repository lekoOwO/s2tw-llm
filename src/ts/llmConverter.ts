// llmConverter.ts

import { getOpenAIConfig } from './openaiConfig';

// symbolMap: symbol -> { sentence, done }
interface SymbolEntry {
  sentence: string;
  done: boolean;
  index: number; // 新增 index 屬性
}

const symbolMap = new Map<symbol, SymbolEntry>();

export function convertWithLLM(sentence: string, index?: number): symbol {
  const sym = Symbol();
  symbolMap.set(sym, { sentence, done: false, index: index ?? -1 });
  return sym;
}

async function callOpenAIForBatch(sentences: string[], indexes?: number[]): Promise<string[]> {
  if (typeof process !== 'undefined' && process.env && process.env.VITEST) {
    return sentences.map(s => s + '（mock-繁體）');
  }
  const { endpoint, token } = getOpenAIConfig();
  if (!endpoint || !token) throw new Error('OpenAI API endpoint/token 未設定');
  const model = getOpenAIConfig().model || 'gpt-3.5-turbo';

  // 用原始 index 當 key
  const inputObj: Record<string, string> = {};
  sentences.forEach((s, i) => {
    const key = indexes ? String(indexes[i]) : `s${i}`;
    inputObj[key] = s;
  });

  const systemPrompt = "請將以下 JSON 物件中的簡體中文 value 轉成臺灣繁體中文，保留語意與語境，注意一簡對多繁的轉換。只需要提供翻譯後的 JSON。key 不要變動，value 只需翻譯，不要解釋。";
  const userPrompt = JSON.stringify(inputObj);
  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' }
  };
  let res;
  let retryCount = 0;
  const maxRetries = 16;
  const retryDelay = 2000;
  while (true) {
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
    } catch (e) {
      // 網路錯誤或 fetch 拋出（如 504 斷線）
      if (retryCount >= maxRetries) throw new Error('OpenAI API 請求失敗，重試多次仍失敗');
      await new Promise(res => setTimeout(res, retryDelay));
      retryCount++;
      continue;
    }
    if (res.status !== 429 && res.status !== 504) break;
    if (retryCount >= maxRetries) throw new Error(`OpenAI API 請求過於頻繁 (${res.status})，重試多次仍失敗`);
    await new Promise(res => setTimeout(res, retryDelay));
    retryCount++;
  }
  if (!res.ok) throw new Error('OpenAI API 請求失敗');
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI API 回傳格式錯誤');
  let obj;
  try {
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\s*/i, '').replace(/```\s*$/i, '');
    }
    obj = JSON.parse(jsonStr);
  } catch {
    throw new Error('OpenAI 回傳內容非合法 JSON');
  }
  // 根據 indexes 對應回原始位置
  if (indexes) {
    return indexes.map(idx => obj[String(idx)] ?? '');
  } else {
    return sentences.map((_, i) => obj[`s${i}`]);
  }
}

// 用戶可在 localStorage 設定 openaiTokenLimit，預設 2048
function getTokenLimit(): number {
  if (typeof localStorage !== 'undefined') {
    const v = localStorage.getItem('openaiTokenLimit');
    if (v && !isNaN(Number(v))) return Number(v);
  }
  return 2048;
}

// 粗略估算一行的 token 數（可根據實際模型微調）
function estimateTokens(str: string): number {
  // 英文單詞/標點/空格算 1，中文每字算 2
  let tokens = 0;
  for (const ch of str) {
    if (/[ -]/.test(ch)) tokens += 1.5;
    else tokens += 3;
  }
  return tokens;
}

// 全域 batch 狀態供 UI 讀取
let lastBatchTotal = 0;
let lastBatchCurrent = 0;

export function getLastBatchStatus() {
  // 若尚未分批，回傳 undefined 讓 UI 不顯示 batch 進度
  if (lastBatchTotal === 0) return undefined;
  return {
    total: lastBatchTotal,
    current: lastBatchCurrent
  };
}

export async function batchLLMConvert(symbols: symbol[]): Promise<void> {
  const pendingSymbols = symbols.filter(sym => {
    const entry = symbolMap.get(sym);
    return entry && !entry.done;
  });
  if (pendingSymbols.length === 0) return;
  const tokenLimit = getTokenLimit();
  // 分批組 batch
  let batchSyms: symbol[] = [];
  let batchTokens = 0;
  const batches: symbol[][] = [];
  for (const sym of pendingSymbols) {
    const sentence = symbolMap.get(sym)!.sentence;
    const tokens = estimateTokens(sentence);
    if (batchTokens + tokens > tokenLimit && batchSyms.length > 0) {
      batches.push(batchSyms);
      batchSyms = [];
      batchTokens = 0;
    }
    batchSyms.push(sym);
    batchTokens += tokens;
  }
  if (batchSyms.length > 0) batches.push(batchSyms);
  lastBatchTotal = batches.length;
  let finished = 0;
  // 先推播 0/total，讓 UI 顯示初始狀態
  if (typeof window !== 'undefined' && typeof (window as any).onLLMBatchProgress === 'function') {
    (window as any).onLLMBatchProgress({ current: 0, total: lastBatchTotal });
  }
  // 控制最大併發數
  let MAX_CONCURRENT = 12;
  if (typeof localStorage !== 'undefined') {
    const v = localStorage.getItem('openaiMaxConcurrent');
    if (v && !isNaN(Number(v))) MAX_CONCURRENT = Math.max(1, Math.min(32, Number(v)));
  }
  let running = 0;
  let idx = 0;
  async function runNext() {
    if (idx >= batches.length) return;
    const myIdx = idx++;
    running++;
    const syms = batches[myIdx];
    const sentences = syms.map(sym => symbolMap.get(sym)!.sentence);
    const indexes = syms.map(sym => symbolMap.get(sym)!.index);
    try {
      const results = await callOpenAIForBatch(sentences, indexes);
      syms.forEach((sym, j) => {
        symbolMap.set(sym, { sentence: results[j], done: true, index: indexes[j] });
      });
    } finally {
      finished++;
      running--;
      if (typeof window !== 'undefined' && typeof (window as any).onLLMBatchProgress === 'function') {
        (window as any).onLLMBatchProgress({ current: finished, total: lastBatchTotal });
      }
      // 啟動下一個 batch
      if (idx < batches.length) {
        await runNext();
      }
    }
  }
  // 啟動前 MAX_CONCURRENT 個 batch
  const starters = [];
  for (let i = 0; i < Math.min(MAX_CONCURRENT, batches.length); i++) {
    starters.push(runNext());
  }
  await Promise.all(starters);
  lastBatchCurrent = lastBatchTotal;
}

export async function symbolToString(sym: symbol): Promise<string> {
  const waitUntilDone = async () => {
    let entry = symbolMap.get(sym);
    while (entry && !entry.done) {
      await new Promise(res => setTimeout(res, 10));
      entry = symbolMap.get(sym);
    }
    return entry;
  };
  const entry = await waitUntilDone();
  if (!entry) return '';
  return entry.sentence;
}

// 將 symbolMap, getTokenLimit, estimateTokens 暴露到 window 供 main.ts 取用
export { symbolMap, getTokenLimit, estimateTokens };
