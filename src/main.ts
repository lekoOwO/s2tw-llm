import '/style.css';
import { renderOpenAIConfigUI } from './ui/openaiConfigUI';
import { renderFileDropUI } from './ui/fileDropUI';
import { containsAmbiguousChar } from './ts/ambiguousDetector';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <h1>智慧簡轉繁系統</h1>
  <div id="openai-config-area"></div>
  <div id="file-drop-area"></div>
`;

// 渲染 OpenAI API 設定 UI
renderOpenAIConfigUI('openai-config-area');

// 檔案內容暫存
let fileContent = '';

// 渲染檔案拖拉/選擇與預覽 UI，並取得檔案內容
const fileDropArea = document.getElementById('file-drop-area')!;
renderFileDropUI(fileDropArea, content => {
  fileContent = content;
});

// 處理「轉換」按鈕
import('./ts/main').then(({ processText }) => {
  document.getElementById('convert')!.onclick = async () => {
    const outputDiv = document.getElementById('output') as HTMLDivElement;
    outputDiv.textContent = '處理中...';
    const text = fileContent || '';
    if (!text) {
      outputDiv.textContent = '請先拖曳或選擇檔案';
      return;
    }
    // 分開顯示 OpenCC/LLM 進度
    const progressDiv = document.createElement('div');
    progressDiv.id = 'progress-info';
    progressDiv.style.margin = '12px 0';
    const openccDiv = document.createElement('div');
    openccDiv.id = 'opencc-progress';
    openccDiv.textContent = 'OpenCC 進度：0/0';
    const llmDiv = document.createElement('div');
    llmDiv.id = 'llm-progress';
    llmDiv.textContent = 'LLM 進度：0/0';
    progressDiv.appendChild(openccDiv);
    progressDiv.appendChild(llmDiv);
    outputDiv.innerHTML = '';
    outputDiv.appendChild(progressDiv);
    // 狀態統計
    let openccCount = 0, openccTotal = 0;
    let llmCount = 0, llmTotal = 0;
    let llmWaiting = false;
    // 預先計算 llm/opencc 行數
    const lines = text.split(/\r?\n/);
    llmTotal = lines.filter(line => line && containsAmbiguousChar(line)).length;
    openccTotal = lines.filter(line => line && !containsAmbiguousChar(line)).length;
    openccDiv.textContent = `OpenCC 進度：0/${openccTotal}`;
    llmDiv.textContent = `LLM 進度：0/${llmTotal}`;

    // === 預估 LLM batch 數量 ===
    const { estimateTokens, getTokenLimit } = await import('./ts/llmConverter');
    const tokenLimit = getTokenLimit();
    let batchSyms = 0, batchTokens = 0, batchCount = 0;
    for (const line of lines) {
      if (!line || !containsAmbiguousChar(line)) continue;
      const tokens = estimateTokens(line);
      if (batchTokens + tokens > tokenLimit && batchSyms > 0) {
        batchCount++;
        batchSyms = 0;
        batchTokens = 0;
      }
      batchSyms++;
      batchTokens += tokens;
    }
    if (batchSyms > 0) batchCount++;
    if (batchCount > 0) {
      llmDiv.innerHTML += `<br>預估 LLM batch 數：${batchCount}`;
    }
    // 包裝 batchLLMConvert，不直接覆蓋 module
    const llmConverter = await import('./ts/llmConverter');
    const origBatchLLMConvert = llmConverter.batchLLMConvert;
    async function batchLLMConvertWithProgress(symbols: symbol[]) {
      // 直接呼叫原始 batchLLMConvert，讓分批只做一次，進度顯示正確
      await origBatchLLMConvert(symbols);
      // 若要顯示 batch 數，可在 llmConverter.ts 的 batchLLMConvert 內設全域變數或事件
    }
    // 註冊 batch 進度推播（需在 processText 執行前）
    (window as any).onLLMBatchProgress = ({ current, total }: { current: number, total: number }) => {
      llmDiv.innerHTML = `LLM 進度：${llmCount}/${llmTotal}<br>正在等待的 batch：${current}/${total}<br>正在等待 LLM 回覆...`;
    };
    try {
      const result = await processText(text, {
        onProgress: info => {
          if (info.type === 'opencc') {
            openccCount++;
            openccDiv.textContent = `OpenCC 進度：${openccCount}/${openccTotal}`;
          } else if (info.type === 'llm') {
            llmCount++;
            llmDiv.textContent = `LLM 進度：${llmCount}/${llmTotal}`;
            // 當 LLM 行都已送出，顯示等待
            if (llmCount === llmTotal) {
              llmWaiting = true;
              // 讀取最新 batch 狀態
              const { getLastBatchStatus } = llmConverter;
              const batchStatus = getLastBatchStatus();
              if (batchStatus) {
                llmDiv.innerHTML = `LLM 進度：${llmTotal}/${llmTotal}<br>正在等待的 batch：${batchStatus.current}/${batchStatus.total}<br>正在等待 LLM 回覆...`;
              } else {
                llmDiv.innerHTML = `LLM 進度：${llmTotal}/${llmTotal}<br>正在等待 LLM 回覆...`;
              }
            }
          }
        },
        batchLLMConvert: batchLLMConvertWithProgress
      });
      // 若 LLM 行數為 0 或未觸發等待，確保不殘留等待提示
      if (llmTotal === 0 || !llmWaiting) {
        llmDiv.textContent = `LLM 進度：${llmCount}/${llmTotal}`;
      }
      // 取得原始檔名並用 OpenCC 進行簡轉繁（支援拖曳與選檔）
      let filename = 'converted.txt';
      let file: File | undefined;
      const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
      if (fileInput && fileInput.files && fileInput.files[0]) {
        file = fileInput.files[0];
      } else {
        const dropArea = document.getElementById('drop-area');
        if (dropArea && (dropArea as any)._lastFile) {
          file = (dropArea as any)._lastFile;
        }
      }
      if (file) {
        const originalName = file.name;
        const dotIdx = originalName.lastIndexOf('.');
        const base = dotIdx > 0 ? originalName.slice(0, dotIdx) : originalName;
        const ext = dotIdx > 0 ? originalName.slice(dotIdx) : '.txt';
        const { convertWithOpenCC } = await import('./ts/openccConverter');
        const twName = await convertWithOpenCC(base);
        filename = twName + ext;
      }
      // 建立下載連結，確保換行符號為 \r\n 以便 Windows 記事本正確顯示分行
      const normalized = result.replace(/\r?\n/g, '\r\n');
      const blob = new Blob([normalized], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.textContent = '下載轉換結果';
      a.style.display = 'inline-block';
      a.style.marginTop = '12px';
      outputDiv.innerHTML = '';
      outputDiv.appendChild(a);
    } catch (err) {
      outputDiv.textContent = '處理失敗：' + (err instanceof Error ? err.message : String(err));
    }
  };
});
