// file: ui/fileDropUI.ts
export function renderFileDropUI(app: HTMLElement, onFile: (content: string) => void) {
  app.innerHTML = `
    <div id="drop-area" style="border:2px dashed #bbb;padding:24px 12px;margin-bottom:12px;text-align:center;border-radius:8px;">
      <p style="margin:0 0 8px 0;">拖曳 .txt 檔案到此，或 <label style='color:#1976d2;cursor:pointer;text-decoration:underline;background:transparent;'><input type='file' id='file-input' accept='.txt' style='display:none;'>點擊選擇檔案</label></p>
      <div id="encoding-select-wrap" style="margin-bottom:8px; display:none;">
        <label for="encoding-select">編碼：</label>
        <select id="encoding-select" style="min-width:90px;">
          <option value="utf-8">UTF-8</option>
          <option value="gbk">GBK</option>
          <option value="gb18030">GB18030</option>
        </select>
      </div>
      <div id="file-preview" style="display:none;text-align:left;border-radius:6px;padding:8px 10px;margin-bottom:8px;max-height:180px;overflow:auto;font-size:0.98em;"></div>
    </div>
    <button id="convert">轉換</button>
    <div class="output" id="output" style="margin-top:18px;"></div>
  `;

  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const dropArea = document.getElementById('drop-area')!;
  const filePreview = document.getElementById('file-preview') as HTMLDivElement;
  const encodingSelect = document.getElementById('encoding-select') as HTMLSelectElement;
  const encodingWrap = document.getElementById('encoding-select-wrap') as HTMLDivElement;
  let fileContent = '';

  // 新增預估 batch 數顯示區塊
  const batchEstimateDiv = document.createElement('div');
  batchEstimateDiv.id = 'llm-batch-estimate';
  batchEstimateDiv.style.color = '#888';
  batchEstimateDiv.style.fontSize = '0.98em';
  batchEstimateDiv.style.margin = '4px 0 0 0';
  app.appendChild(batchEstimateDiv);

  // 預估 batch 數的函式
  async function estimateLLMBatchCount(content: string) {
    const { containsAmbiguousChar } = await import('../ts/ambiguousDetector');
    const { estimateTokens, getTokenLimit } = await import('../ts/llmConverter');
    const lines = content.split(/\r?\n/);
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
      batchEstimateDiv.innerHTML = `預估 LLM batch 數：<b>${batchCount}</b>`;
    } else {
      batchEstimateDiv.innerHTML = '';
    }
  }

  function showPreview(content: string) {
    filePreview.style.display = 'block';
    encodingWrap.style.display = 'block'; // 有檔案時顯示編碼選擇
    // 只顯示前 10 行，並保留換行格式
    const lines = content.split(/\r?\n/).slice(0, 10);
    filePreview.innerText = lines.join('\n') + (content.split(/\r?\n/).length > 10 ? '\n...（僅預覽前 10 行）' : '');
    filePreview.style.whiteSpace = 'pre-line';
    estimateLLMBatchCount(content);
  }

  // 若清空檔案時，隱藏編碼選擇與預覽
  function hidePreviewAndEncoding() {
    filePreview.style.display = 'none';
    encodingWrap.style.display = 'none';
  }

  function readFileWithEncoding(file: File, encoding: string, cb: (content: string) => void) {
    const reader = new FileReader();
    reader.onload = ev => {
      const buf = ev.target?.result;
      if (!buf || !(buf instanceof ArrayBuffer)) {
        cb('');
        return;
      }
      try {
        const decoder = new TextDecoder(encoding);
        const content = decoder.decode(new Uint8Array(buf));
        cb(content);
      } catch {
        cb('');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  ['dragenter','dragover'].forEach(evt => dropArea.addEventListener(evt, e => {
    e.preventDefault();
    dropArea.style.background = '#e3f2fd';
  }));
  ['dragleave','drop'].forEach(evt => dropArea.addEventListener(evt, e => {
    e.preventDefault();
    dropArea.style.background = 'unset';
  }));
  dropArea.addEventListener('drop', e => {
    const files = (e as DragEvent).dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      const encoding = encodingSelect.value;
      readFileWithEncoding(file, encoding, content => {
        fileContent = content;
        showPreview(fileContent);
        onFile(fileContent);
        estimateLLMBatchCount(fileContent);
      });
    } else {
      hidePreviewAndEncoding();
    }
  });
  fileInput.addEventListener('change', () => {
    const files = fileInput.files;
    if (files && files.length > 0) {
      const file = files[0];
      const encoding = encodingSelect.value;
      readFileWithEncoding(file, encoding, content => {
        fileContent = content;
        showPreview(fileContent);
        onFile(fileContent);
        estimateLLMBatchCount(fileContent);
      });
    } else {
      hidePreviewAndEncoding();
    }
  });
  encodingSelect.addEventListener('change', () => {
    // 若已有檔案內容，重新 decode 並預覽
    // 需同時考慮拖曳與 input 兩種來源
    let file: File | null = null;
    if (fileInput.files && fileInput.files.length > 0) {
      file = fileInput.files[0];
    } else if ((dropArea as any)._lastFile instanceof File) {
      file = (dropArea as any)._lastFile;
    }
    if (file) {
      const encoding = encodingSelect.value;
      readFileWithEncoding(file, encoding, content => {
        fileContent = content;
        showPreview(fileContent);
        onFile(fileContent);
        estimateLLMBatchCount(fileContent);
      });
    }
  });

  // 記錄最後一次拖曳的檔案，讓切換編碼時也能正確預覽
  dropArea.addEventListener('drop', e => {
    const files = (e as DragEvent).dataTransfer?.files;
    if (files && files.length > 0) {
      (dropArea as any)._lastFile = files[0];
      const file = files[0];
      const encoding = encodingSelect.value;
      readFileWithEncoding(file, encoding, content => {
        fileContent = content;
        showPreview(fileContent);
        onFile(fileContent);
        estimateLLMBatchCount(fileContent);
      });
    }
  });
  fileInput.addEventListener('change', () => {
    const files = fileInput.files;
    if (files && files.length > 0) {
      (dropArea as any)._lastFile = files[0];
      const file = files[0];
      const encoding = encodingSelect.value;
      readFileWithEncoding(file, encoding, content => {
        fileContent = content;
        showPreview(fileContent);
        onFile(fileContent);
        estimateLLMBatchCount(fileContent);
      });
    }
  });

  // 監聽 tokenLimit 變動時自動更新 batch 預估
  const tokenLimitInput = document.getElementById('openai-token-limit') as HTMLInputElement | null;
  if (tokenLimitInput) {
    tokenLimitInput.addEventListener('input', async () => {
      // 強制觸發 estimateLLMBatchCount 時，直接用最新 input 值
      const val = tokenLimitInput.value;
      const { containsAmbiguousChar } = await import('../ts/ambiguousDetector');
      const { estimateTokens } = await import('../ts/llmConverter');
      const lines = fileContent.split(/\r?\n/);
      if (val && !isNaN(Number(val))) {
        let batchSyms = 0, batchTokens = 0, batchCount = 0;
        for (const line of lines) {
          if (!line || !containsAmbiguousChar(line)) continue;
          const tokens = estimateTokens(line);
          if (batchTokens + tokens > Number(val) && batchSyms > 0) {
            batchCount++;
            batchSyms = 0;
            batchTokens = 0;
          }
          batchSyms++;
          batchTokens += tokens;
        }
        if (batchSyms > 0) batchCount++;
        if (batchCount > 0) {
          batchEstimateDiv.innerHTML = `預估 LLM batch 數：<b>${batchCount}</b>`;
        } else {
          batchEstimateDiv.innerHTML = '';
        }
      } else {
        estimateLLMBatchCount(fileContent);
      }
    });
  }

  return {
    getFileContent: () => fileContent,
    setPreview: showPreview
  };
}
