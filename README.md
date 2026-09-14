# TypeScript Learning RAG

手刻一個最小 RAG，目的是理解每個環節，不是做產品。刻意不用 LangChain / LlamaIndex。

## 語料庫

React Native 官方文件（公開，文件部分 CC BY 4.0，程式碼 MIT）。抓取方式：

```bash
mkdir -p data
git clone --depth 1 --filter=blob:none --sparse \
  https://github.com/facebook/react-native-website.git data/_tmp
git -C data/_tmp sparse-checkout set docs
mv data/_tmp/docs data/docs && rm -rf data/_tmp
```

語料庫根目錄是 `data/docs`。`data/` 整個在 `.gitignore` 裡 ——
不是因為機密（RN 文件本來就公開），而是它是第三方內容 + 會反覆重建的索引產物，
不該混進自己的 diff。可重現性由上面這段指令保證。

規模（遞迴計算，含所有檔案）：

| | |
|---|---|
| `.md` + `.mdx` | 237（其中 13 個 `_` 開頭的 partial） |
| 子目錄 | `legacy/` 8 檔、`the-new-architecture/` 15 檔 |
| 約 token 數 | ~551k |
| `##` heading | 2043 |

要不要納入 partial 與子目錄是你的設計決定，所以上面是全量數字。

## 環境

Node 24（`.nvmrc` 已指定）。Node 22.18+ 起原生支援直接跑 `.ts`，零 build step。

```bash
nvm use            # 切到 24.15.0
npm start          # node src/index.ts
npm run dev        # 存檔自動重跑
npm run typecheck  # tsc --noEmit
```

⚠️ **Node 只做 type stripping，不做型別檢查** —— 型別錯誤照樣跑得起來。
型別檢查是 `npm run typecheck` 的工作，兩者分開。

### type stripping 不支援的語法

`enum` / 有 runtime code 的 `namespace` / parameter properties / decorators / import 別名。
`tsconfig.json` 開了 `erasableSyntaxOnly: true`，用到會直接在型別檢查時報錯。

import 自己的檔案要帶副檔名：`import { chunk } from './chunk.ts'`。

## 還沒裝的東西

| 用途 | 建議 |
|------|------|
| 生成 | `@anthropic-ai/sdk` |
| embedding | Voyage（`voyage-3`）或 OpenAI `text-embedding-3-small`，直接打 HTTP 即可 |
| BM25 | 自己刻（~30 行），這是最值得手寫的部分 |

Anthropic **沒有** embeddings API，embedding 必須另外找一家。
API key 放 `.env`（範本見 `.env.example`）。

## 路線

| # | 產出 | 需要 API key |
|---|------|-------------|
| 1 | `loadDocs()` + `chunk()` | ❌ |
| 2 | 20 題 `eval.json` | ❌ |
| 3 | `bm25()` + `recall@k` baseline | ❌ |
| 4 | 接 Claude 生成 | ✅ Anthropic |
| 5 | 加 embedding → hybrid search | ✅ Voyage/OpenAI |

前三步零成本。最後可以拿同樣 20 題跑「整包 444k 塞進 context」的對照組，
直接比較 RAG 的代價與收益。
