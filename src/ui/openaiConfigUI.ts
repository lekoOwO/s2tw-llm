// file: ui/openaiConfigUI.ts
import { getOpenAIConfig, setOpenAIConfig } from '../ts/openaiConfig';

export function renderOpenAIConfigUI(containerId: string = 'openai-config-area') {
  const configDiv = document.createElement('div');
  configDiv.innerHTML = `
    <details style="margin-bottom:16px;max-width:700px;margin-left:auto;margin-right:auto;">
      <summary style="font-size:1.1em;font-weight:bold;">OpenAI API 設定</summary>
      <div style="display:flex;flex-direction:column;gap:10px;padding:8px 0 0 0;align-items:center;justify-content:center;">
        <div style="display:flex;gap:16px;width:100%;max-width:650px;">
          <label style="flex:2 1 70%;min-width:320px;">Endpoint:<br><input id="openai-endpoint" style="width:100%;margin-top:2px"></label>
          <label style="flex:1 1 30%;min-width:120px;">Model:<br><input id="openai-model" style="width:100%;margin-top:2px" placeholder="gpt-3.5-turbo"></label>
        </div>
        <div style="display:flex;gap:16px;width:100%;max-width:650px;align-items:flex-end;">
          <label style="flex:1 1 100%;min-width:320px;">Token:<br><input id="openai-token" type="password" style="width:100%;margin-top:2px"></label>
          <label style="flex:1 1 100%;min-width:120px;">Token 上限:<br><input id="openai-token-limit" type="number" min="256" max="32768" step="1" style="width:100%;margin-top:2px" placeholder="16385"></label>
          <label style="flex:1 1 100%;min-width:120px;">併發請求數:<br><input id="openai-max-concurrent" type="number" min="1" max="32" step="1" style="width:100%;margin-top:2px" placeholder="12"></label>
          <div style="display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0;position:relative;bottom:-8px;">
            <button id="save-openai-config" style="height:2.2em;min-width:72px;display:flex;align-items:center;justify-content:center;padding:0 18px;font-size:1em;">儲存</button>
            <span id="openai-config-status" style="margin-left:8px;color:#0a0;font-weight:bold;margin-top:2px;"></span>
          </div>
        </div>
      </div>
    </details>
  `;
  configDiv.style.display = 'flex';
  configDiv.style.justifyContent = 'center';
  configDiv.style.width = '100%';
  document.getElementById(containerId)!.appendChild(configDiv);

  const endpointInput = document.getElementById('openai-endpoint') as HTMLInputElement;
  const tokenInput = document.getElementById('openai-token') as HTMLInputElement;
  const modelInput = document.getElementById('openai-model') as HTMLInputElement;
  const statusSpan = document.getElementById('openai-config-status')!;
  const tokenLimitInput = document.getElementById('openai-token-limit') as HTMLInputElement;

  const { endpoint, token, model } = getOpenAIConfig();
  endpointInput.value = endpoint;
  tokenInput.value = token;
  modelInput.value = model || '';

  // 載入 localStorage token limit
  tokenLimitInput.value = localStorage.getItem('openaiTokenLimit') || '16385';

  // 新增最大併發數 input
  const maxConcurrentInput = document.getElementById('openai-max-concurrent') as HTMLInputElement;
  maxConcurrentInput.value = localStorage.getItem('openaiMaxConcurrent') || '12';

  document.getElementById('save-openai-config')!.onclick = () => {
    setOpenAIConfig({ endpoint: endpointInput.value, token: tokenInput.value, model: modelInput.value });
    // 儲存 token limit
    if (tokenLimitInput.value && !isNaN(Number(tokenLimitInput.value))) {
      localStorage.setItem('openaiTokenLimit', tokenLimitInput.value);
    }
    // 儲存最大併發數
    if (maxConcurrentInput.value && !isNaN(Number(maxConcurrentInput.value))) {
      localStorage.setItem('openaiMaxConcurrent', maxConcurrentInput.value);
    }
    statusSpan.textContent = '已儲存';
    setTimeout(() => (statusSpan.textContent = ''), 1500);
  };
}
