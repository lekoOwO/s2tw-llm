# s2tw-llm

s2tw-llm 是一個支援簡繁轉換（OpenCC/LLM）的前端專案，專為大檔案、逐行、順序保留的高品質轉換設計。支援自動/手動選擇 txt 檔案編碼、OpenAI API 設定、LLM/OPENCC 批次處理、token 上限與併發數自訂，並可一鍵部署到 GitHub Pages。

## 主要功能
- 支援 txt 檔案自動/手動編碼選擇，預覽即時更新
- 逐行分批處理，保留原始行序、分行、空行
- LLM/OPENCC 批次處理，支援 token 上限與最大併發數自訂
- 進度與 batch 狀態即時顯示，錯誤自動重試
- OpenAI API 設定 UI，token 上限、併發數可調整
- 下載檔案時自動正規化換行與檔名簡繁轉換
- 本地端自動化測試，驗證行數、順序、內容正確
- GitHub Actions CI/CD，自動 build & deploy 到 gh-pages

## 技術架構
- 前端：TypeScript + Vite + pnpm
- 轉換：OpenCC（本地）、LLM（OpenAI API）
- 測試：Vitest
- 部署：GitHub Pages，自動化 workflow

## 開發流程
本專案全程由 LLM Vibe Coding 生成，沒有一行人寫的 Code :)

## 快速開始
1. 安裝依賴：`pnpm install`
2. 本地開發：`pnpm run dev`
3. 執行測試：`pnpm test`
4. 打包建置：`pnpm run build`
5. 部署：push 到 main/master，自動部署到 GitHub Pages

## 相關檔案
- `src/`：主程式碼
- `test/`：自動化測試
- `.github/workflows/gh-pages.yml`：自動部署 workflow

---

本專案完全由 AI 生成，歡迎體驗 LLM Coding 的未來！
