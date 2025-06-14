// openaiConfig.ts
// 管理 OpenAI API endpoint 與 token，並支援 localStorage 儲存與前端設定

export interface OpenAIConfig {
  endpoint: string;
  token: string;
  model?: string; // 新增 model 欄位，供用戶自訂
}

const STORAGE_KEY = 'openai-config';

export function getOpenAIConfig(): OpenAIConfig {
  if (typeof localStorage === 'undefined') {
    // 測試或非瀏覽器環境 fallback
    return { endpoint: '', token: '' };
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {}
  }
  return { endpoint: '', token: '' };
}

export function setOpenAIConfig(config: OpenAIConfig) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
